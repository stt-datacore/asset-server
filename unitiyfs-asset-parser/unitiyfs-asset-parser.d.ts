declare module 'unitiyfs-asset-parser' {
	export interface Sprite {
		spriteName: string;
		spriteBitmap: {
			data: Buffer;
			width: number;
			height: number;
		};
	}

	export interface ParseResults {
		imageName: string;
		imageBitmap: {
			data: Buffer;
			width: number;
			height: number;
		};
		sprites: Array<Sprite>;
	}
	
	export interface BundleManifestEntry {
		name: string;
		hash: number[];
		dependencies: number[];
	}

	export interface AssetBundleManifest {
		assetBundleManifest: BundleManifestEntry[];
	}

	export function parseAssetBundle(data: Uint8Array): ParseResults | undefined;
	export function parseAssetBundleManifest(data: Uint8Array): AssetBundleManifest | undefined;
}
