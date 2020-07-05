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

	export interface AssetBundleManifest {
		assetBundleManifest: string[];
	}

	export function parseAssetBundle(data: Uint8Array): ParseResults | undefined;
	export function parseAssetBundleManifest(data: Uint8Array): AssetBundleManifest | undefined;
}
