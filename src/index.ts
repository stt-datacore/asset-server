import * as fs from 'fs';
import * as path from 'path';
import * as pngjs from 'pngjs';
import fetch from 'node-fetch';
import { parseAssetBundle, parseAssetBundleManifest } from 'unitiyfs-asset-parser';

require('dotenv').config();

const OUT_PATH = path.resolve(process.env.OUT_PATH ? process.env.OUT_PATH : path.join(__dirname, 'out'));

const CLIENT_PLATFORM_FOLDER = 'webgl';

function assetDestination(iconName: string) {
	return path.join(OUT_PATH, '/assets/', iconName.length < 2 ? '/atlas/' : `${iconName}.png`);
}

function bestResolution(resolutions: string[]) {
	// xd > hd > sd > ld
	if (resolutions.includes('xd')) {
		return 'xd';
	} else if (resolutions.includes('hd')) {
		return 'hd';
	} else if (resolutions.includes('sd')) {
		return 'sd';
	} else if (resolutions.includes('ld')) {
		return 'ld';
	} else {
		console.warn(`Unknown resolution: ${resolutions[0]}`);
		return resolutions[0];
	}
}

function writePNG(rawBitmap: Buffer, width: number, height: number) {
	var png = new pngjs.PNG({ width, height });
	png.data = rawBitmap;
	return pngjs.PNG.sync.write(png);
}

async function downloadAsset(asset_url: string, url: string, filePath: string, withSprites: boolean) {
	let response = await fetch(asset_url + url);
	if (!response.ok) {
		throw Error(`Failed to fetch asset '${asset_url + url}'`);
	}

	let downloadedData = await response.buffer();

	if (!withSprites) {
		console.log(`Downloading from ${asset_url + url}...`);
	}

	try {
		let result = await parseAssetBundle(downloadedData);
		if (!result) {
			if (!withSprites) {
				throw Error(`Failed to parse asset '${asset_url + url}'`);
			}
			return;
		}

		if (result.sprites.length > 1) {
			if (withSprites) {
				result.sprites.forEach(sprite => {
					let pngImage = writePNG(sprite.spriteBitmap.data, sprite.spriteBitmap.width, sprite.spriteBitmap.height);
					let outPath = path.join(filePath, `${sprite.spriteName}.png`);
					fs.writeFileSync(outPath, pngImage);
				});
			} else {
				throw Error(`Unexpected sprite found in image asset '${asset_url + url}'`);
			}
		} else if (
			result.sprites.length === 1 ||
			(result.imageName && result.imageBitmap && result.imageBitmap.width > 0)
		) {
			let pngImage = writePNG(result.imageBitmap.data, result.imageBitmap.width, result.imageBitmap.height);
			fs.writeFileSync(filePath, pngImage);
		}
	} catch (ex) {
		throw Error(`Exception while parsing asset '${asset_url + url}': ${ex}`);
	}
}

async function getLatestBundleVersion() {
	let response = await fetch(`https://stt-cdn-services.s3.amazonaws.com/production/${CLIENT_PLATFORM_FOLDER}_minimum_version.txt`);
	if (!response.ok) {
		throw Error('Failed to fetch minimum version');
	}

	let client_version = (await response.text()).trim();

	response = await fetch(`https://stt-cdn-services.s3.amazonaws.com/production/${CLIENT_PLATFORM_FOLDER}_${client_version}.txt`);
	if (!response.ok) {
		throw Error('Failed to fetch bundle version');
	}

	let bundle_version = (await response.text()).trim();

	return {client_version, bundle_version};
}

async function loadAssetURL(client_version: string, bundle_version: string) {
	let configUrl = `https://stt.disruptorbeam.com/config?client_version=${client_version}&platform_folder=${CLIENT_PLATFORM_FOLDER}`;

	let response = await fetch(configUrl);
	if (!response.ok) {
		throw Error('Failed to fetch config');
	}

	let data = await response.json();

	console.log(`Config URL: '${configUrl}'; bundle_version: '${bundle_version}'`);

	return `${data.config.asset_server}bundles/${CLIENT_PLATFORM_FOLDER}/default/${client_version}/${bundle_version}/`;
}

async function recordChangeLog(bundle_version: string, images: Map<string, string[]>) {
	let versions = [];
	if (fs.existsSync(path.join(OUT_PATH, '/data/versions.json'))) {
		versions = JSON.parse(fs.readFileSync(path.join(OUT_PATH, '/data/versions.json'), 'utf8'));
	}

	let previousAssets = (versions.length > 0) ? versions[versions.length - 1].assets : [];

	let sanityCheck = versions.find((ver: any) => ver.version === bundle_version);
	if (sanityCheck) {
		console.warn('Duplicate entries in versions.json');
		return;
	}

	versions.push({
		version: bundle_version,
		assets: Array.from(images.keys())
	});

	fs.writeFileSync(path.join(OUT_PATH, '/data/versions.json'), JSON.stringify(versions), 'utf8');

	// generate changelog
	let changelog = [];
	if (fs.existsSync(path.join(OUT_PATH, '/data/changelog.json'))) {
		changelog = JSON.parse(fs.readFileSync(path.join(OUT_PATH, '/data/changelog.json'), 'utf8'));
	}

	let newAssets = [];
	for (const [key, val] of images) {
		if (!previousAssets.includes(key)) {
			newAssets.push(key);
		}
	}

	changelog.push({
		version: bundle_version,
		newAssets
	});

	fs.writeFileSync(path.join(OUT_PATH, '/data/changelog.json'), JSON.stringify(changelog), 'utf8');
}

async function main() {
	if (!fs.existsSync(path.join(OUT_PATH, '/assets/'))) {
		fs.mkdirSync(path.join(OUT_PATH, '/assets/'));
	}

	if (!fs.existsSync(path.join(OUT_PATH, '/assets/atlas/'))) {
		fs.mkdirSync(path.join(OUT_PATH, '/assets/atlas/'));
	}

	if (!fs.existsSync(path.join(OUT_PATH, '/data/'))) {
		fs.mkdirSync(path.join(OUT_PATH, '/data/'));
	}

	console.log(`Running on ${new Date().toString()}...`);

	const { client_version, bundle_version } = await getLatestBundleVersion();

	let latestVersion = 'NONE';
	if (fs.existsSync(path.join(OUT_PATH, '/data/latestVersion.txt'))) {
		latestVersion = fs.readFileSync(path.join(OUT_PATH, '/data/latestVersion.txt'), 'utf8').trim();
	}

	if (latestVersion === bundle_version) {
		// Nothing to do, no updates
		console.log(`Nothing to do, no updates (version ${latestVersion})`);
		return;
	}

	console.log(`New version ${bundle_version} (old version ${latestVersion})`);

	const asset_url = await loadAssetURL(client_version, bundle_version);

	console.log(`Found latest asset url as '${asset_url}'`);

	let response = await fetch(asset_url + 'asset_bundles');
	if (!response.ok) {
		console.error('Failed to fetch asset_bundle manifest');
		return;
	}
	let data = await response.buffer();

	let res = await parseAssetBundleManifest(data);
	if (!res) {
		console.error('Failed to parse the asset_bundle manifest');
		return;
	}

	if (res.assetBundleManifest) {
		let images = new Map<string, string[]>();
		let atlases: string[] = [];
		res.assetBundleManifest.forEach(asset => {
			if (asset.startsWith('images_') && asset.endsWith('d')) {
				let name = asset.substr(7);
				let basename = name.substring(0, name.length - 3);
				let ext = name.substring(name.length - 2);
				if (!images.has(basename)) {
					images.set(basename, [ext]);
				} else {
					images.set(basename, images.get(basename)!.concat([ext]));
				}
			} else if (asset.startsWith('atlas_') && asset.endsWith('sd')) {
				atlases.push(asset);
			}
		});

		for (const [key, val] of images) {
			if (!fs.existsSync(assetDestination(key))) {
				try {
					await downloadAsset(asset_url, `images_${key}.${bestResolution(val)}`, assetDestination(key), false);
				} catch (err) {
					console.error(err);
				}
			}
		}

		for (const asset of atlases) {
			try {
				await downloadAsset(asset_url, asset, assetDestination(''), true);
			} catch (err) {
				console.error(err);
			}
		}

		console.log(`Updating latestVersion to ${bundle_version}`);

		fs.writeFileSync(path.join(OUT_PATH, '/data/latestVersion.txt'), bundle_version, 'utf8');
		recordChangeLog(bundle_version, images);

		console.log(`DONE!`);
	}
}

main();
