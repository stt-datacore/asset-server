// Code initially created by IAmPicard. Extended by TemporalAgent7 to add support for asset bundle parsing
var Parser = require('./binary_parser').Parser;
const lz4js = require('lz4js');
const lz4 = require('lz4');
const lzma = require('lzma-native');
const dxt = require('./dxt');

// "polyfill" Buffer
var self = typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this;
self.Buffer = self.Buffer ? self.Buffer : require('buffer/').Buffer;
var Buffer = self.Buffer;

var assetBundle = new Parser()
	.endianess('big')
	.string('signature', {
		zeroTerminated: true,
	})
	.int32('format_version')
	.string('unity_version', {
		zeroTerminated: true,
	})
	.string('generator_version', {
		zeroTerminated: true,
	})
	.int32('file_size1')
	.int32('file_size2')
	.uint32('ciblock_size')
	.uint32('uiblock_size')
	.uint32('flags')
	.array('compressedBlk', {
		type: 'uint8',
		length: 'ciblock_size',
	})
	.array('assets', {
		type: 'uint8',
		readUntil: 'eof',
	});

var blockList = new Parser()
	.endianess('big')
	.skip(16)
	.int32('num_blocks')
	.array('blocks', {
		type: Parser.start().int32('busize').int32('bcsize').int16('bflags'),
		length: 'num_blocks',
	})
	.int32('num_nodes')
	.array('nodes', {
		type: Parser.start().int32('ofs1').int32('ofs2').int32('size1').int32('size2').int32('status').string('name', {
			zeroTerminated: true,
		}),
		length: 'num_nodes',
	});

var typeParser = new Parser()
	.endianess('little')
	.int16('version')
	.uint8('depth')
	.uint8('is_array')
	.int32('typeOffset')
	.int32('nameOffset')
	.int32('size')
	.uint32('index')
	.int32('flags');

var typeTreeParser = new Parser()
	.endianess('little')
	.int32('class_id')
	.choice(undefined, {
		tag: (vars) => vars.format,
		choices: {
			17: Parser.start().endianess('little').int8('unk0').int16('script_id'),
		},
		defaultChoice: Parser.start(),
	})
	.skip(function (vars) {
		if (vars.format === 17) {
			if (this.class_id === 114) {
				this.class_id = this.script_id >= 0 ? -2 - this.script_id : -1;
			}
		}
		return this.class_id < 0 ? 0x20 : 0x10;
	})
	.uint32('num_nodes')
	.uint32('buffer_bytes')
	.array('node_data', {
		type: typeParser,
		length: 'num_nodes',
	})
	.array('buffer_data', {
		type: 'uint8',
		length: 'buffer_bytes',
	});

var typeStructParser = new Parser()
	.endianess('little')
	.string('generator_version', {
		zeroTerminated: true,
	})
	.uint32('target_platform')
	.uint8('has_type_trees')
	.int32('num_types')
	.array('types', {
		type: typeTreeParser,
		length: 'num_types',
	});

var objectParser15 = new Parser()
	.endianess('little')
	.uint32('num_objects')
	.align(4)
	.array('objects', {
		type: Parser.start()
			.skip(3)
			.endianess('little')
			.int32('path_id1')
			.int32('path_id2')
			.uint32('data_offset')
			.uint32('size')
			.int32('type_id')
			.int16('class_id')
			.int16('unk1')
			.int8('unk2')
			.align(4),
		length: 'num_objects',
	})
	.uint32('num_adds', { assert: 0 })
	.uint32('num_refs', { assert: 0 })
	.string('unk_string', {
		zeroTerminated: true,
	});

var objectParser15Manifest = new Parser()
	.endianess('little')
	.uint32('num_objects')
	.align(4)
	.array('objects', {
		type: Parser.start()
			.endianess('little')
			.int32('path_id1')
			.int32('path_id2')
			.uint32('data_offset')
			.uint32('size')
			.int32('type_id')
			.int16('class_id')
			.int16('unk1')
			.int8('unk2')
			.align(4),
		length: 'num_objects',
	})
	.uint32('num_adds', { assert: 0 })
	.uint32('num_refs', { assert: 0 })
	.string('unk_string', {
		zeroTerminated: true,
	});

var objectParser17 = new Parser()
	.endianess('little')
	.uint32('num_objects')
	.array('objects', {
		type: Parser.start()
			.endianess('big')
			.align(4)
			.int32('path_id1')
			.int32('path_id2')
			.uint32('data_offset')
			.uint32('size')
			.int32('type_id'),
		length: 'num_objects',
	})
	.uint32('num_adds', { assert: 0 })
	.uint32('num_refs', { assert: 0 })
	.string('unk_string', {
		zeroTerminated: true,
	});

// Use this parser for images, the big endian for the bundle manifest
var objectParser17Little = new Parser()
	.endianess('little')
	.uint32('num_objects')
	.array('objects', {
		type: Parser.start()
			.endianess('little')
			.align(4)
			.int32('path_id1')
			.int32('path_id2')
			.uint32('data_offset')
			.uint32('size')
			.int32('type_id'),
		length: 'num_objects',
	})
	.uint32('num_adds', { assert: 0 })
	.uint32('num_refs', { assert: 0 })
	.string('unk_string', {
		zeroTerminated: true,
	});

var assetParser = new Parser()
	.endianess('big')
	.uint32('metadata_size')
	.uint32('file_size')
	.uint32('format', { assert: (fmt) => fmt === 15 || fmt === 17 })
	.uint32('data_offset') // Hard-coded assume format > 9
	.uint32('endianness', { assert: 0 })
	.endianess('little')
	.nest('typeStruct', { type: typeStructParser })
	.array('objectData', {
		type: 'uint8',
		readUntil: 'eof',
	});

function alignOff(offset) {
	return (offset + 3) & -4;
}

function read_value(object, type, objectBuffer, offset) {
	let t = type.type;
	let align = false;
	let result;
	if (t == 'bool') {
		result = objectBuffer.readUInt8(offset);
		offset += 1;
	} else if (t == 'SInt8') {
		result = objectBuffer.readInt8(offset);
		offset += 1;
	} else if (t == 'UInt8') {
		result = objectBuffer.readUInt8(offset);
		offset += 1;
	} else if (t == 'SInt16') {
		result = objectBuffer.readInt16LE(offset);
		offset += 2;
	} else if (t == 'UInt16') {
		result = objectBuffer.readUInt16LE(offset);
		offset += 2;
	} else if (t == 'SInt64') {
		result = objectBuffer.readInt32LE(offset);
		let result2 = objectBuffer.readInt32LE(offset + 4);
		offset += 8;
	} else if (t == 'UInt64') {
		result = objectBuffer.readUInt32LE(offset);
		let result2 = objectBuffer.readUInt32LE(offset + 4);
		offset += 8;
	} else if (t == 'UInt32' || t == 'unsigned' || t == 'unsigned int') {
		result = objectBuffer.readUInt32LE(offset);
		offset += 4;
	} else if (t == 'SInt32' || t == 'int') {
		result = objectBuffer.readInt32LE(offset);
		offset += 4;
	} else if (t == 'float') {
		offset = alignOff(offset);
		result = objectBuffer.readFloatLE(offset);
		offset += 4;
	} else if (t == 'string') {
		let size = objectBuffer.readUInt32LE(offset);
		offset += 4;
		result = String.fromCharCode.apply(null, objectBuffer.slice(offset, offset + size));

		if (size > 500) throw new RangeError('offset out of range');

		offset += size;
		align = type.children[0].post_align;
	} else {
		let first_child = type.children.length > 0 ? type.children[0] : undefined;
		if (type.is_array) {
			first_child = type;
		}

		if (t.startsWith('PPtr<')) {
			result = {};

			result.file_id = objectBuffer.readInt32LE(offset);
			offset += 4;

			result.path_id = objectBuffer.readUInt32LE(offset);
			let resultpathid2 = objectBuffer.readUInt32LE(offset + 4);
			offset += 8;
		} else if (first_child && first_child.is_array) {
			align = first_child.post_align;
			let size = objectBuffer.readUInt32LE(offset);
			offset += 4;

			let array_type = first_child.children[1];
			if (array_type.type == 'char' || array_type.type == 'UInt8') {
				result = objectBuffer.slice(offset, offset + size);
				offset += size;
			} else {
				result = [];
				for (let i = 0; i < size; i++) {
					let rVal = read_value(object, array_type, objectBuffer, offset);
					result.push(rVal.result);
					offset = rVal.offset;
				}
			}
		} else if (t == 'pair') {
			console.assert(type.children.length == 2);
			first = read_value(object, type.children[0], objectBuffer, offset);
			offset = first.offset;
			second = read_value(object, type.children[1], objectBuffer, offset);
			offset = second.offset;
			result = { first: first.result, second: second.result };
		} else {
			// A dictionary
			result = {};

			type.children.forEach((child) => {
				let rVal = read_value(object, child, objectBuffer, offset);
				result[child.name] = rVal.result;
				offset = rVal.offset;
			});

			if (t == 'StreamedResource') {
				result.asset = result.source; // resolve_streaming_asset(result.source)
			} else if (t == 'StreamingInfo') {
				result.asset = result.path; // resolve_streaming_asset(result.path)
			}
		}
	}

	if (align || type.post_align) {
		offset = alignOff(offset);
	}

	return { result, offset };
}

async function parseAssetBundle(data, isManifest) {
	var bundle = assetBundle.parse(Buffer.from(data));

	var decompressed = Buffer.alloc(bundle.uiblock_size);
	lz4js.decompressBlock(bundle.compressedBlk, decompressed, 0, bundle.ciblock_size, 0);
	var bundleBlocks = blockList.parse(decompressed);

	let asset = null;
	let compressionType = bundleBlocks.blocks[0].bflags & 0x3f;

	if (compressionType > 0) {
		if (bundleBlocks.blocks[0].bcsize != bundle.assets.length) {
			console.error(`Invalid file (compressed but with more than one asset stream?)`);
			return undefined;
		}
	}

	if (compressionType === 1) {
		// Compressed as LZMA
		let props = bundle.assets.splice(0, 5);

		let lc = props[0] % 9;
		let remainder = props[0] / 9;
		let lp = remainder % 5;
		let pb = remainder / 5;

		let dictionarySize = 0;
		for (let i = 0; i < 4; i++) dictionarySize += props[1 + i] << (i * 8);

		decompressed = await lzma.decompress(bundle.assets, {
			filters: {
				id: 'FILTER_LZMA1',
				options: {
					dictSize: dictionarySize,
					lp: lp,
					lc: lc,
					pb: pb,
				},
			},
		});

		//decompressed = await lzma.decompress(bundle.assets);

		asset = assetParser.parse(decompressed);
	} else if (compressionType === 2) {
		// Compressed as LZ4
		decompressed = Buffer.alloc(bundleBlocks.blocks[0].busize);
		lz4js.decompressBlock(bundle.assets, decompressed, 0, bundleBlocks.blocks[0].bcsize, 0);

		asset = assetParser.parse(decompressed);
	} else if (compressionType === 3) {
		// Compressed as LZ4-HC
		decompressed = Buffer.alloc(bundleBlocks.blocks[0].busize);
		lz4.decodeBlock(bundle.assets, decompressed);

		asset = assetParser.parse(decompressed);
	} else {
		asset = assetParser.parse(Buffer.from(bundle.assets));
	}

	let obj = undefined;
	if (asset.format === 15) {
		if (isManifest) {
			obj = objectParser15Manifest.parse(Buffer.from(asset.objectData));
		} else {
			obj = objectParser15.parse(Buffer.from(asset.objectData));
		}
	} else if (asset.format === 17) {
		if (isManifest) {
			obj = objectParser17.parse(Buffer.from(asset.objectData));
		} else {
			obj = objectParser17Little.parse(Buffer.from(asset.objectData));
		}

		obj.objects.forEach((object, index) => {
			let class_id = object.type_id;

			// Array index could be "index" most of the time ?
			let arIndex = index;
			if (object.type_id >= 0 && object.type_id < asset.typeStruct.types.length) {
				arIndex = object.type_id;
			}
			class_id = asset.typeStruct.types[arIndex].class_id;
			object.type_id = class_id;
			object.class_id = class_id;
		});
	}

	asset.num_objects = obj.num_objects;
	asset.objects = obj.objects;

	const strings =
		'AABB AnimationClip AnimationCurve AnimationState Array Base BitField bitset bool char ColorRGBA Component data deque double dynamic_array FastPropertyName first float Font GameObject Generic Mono GradientNEW GUID GUIStyle int list long long map Matrix4x4f MdFour MonoBehaviour MonoScript m_ByteSize m_Curve m_EditorClassIdentifier m_EditorHideFlags m_Enabled m_ExtensionPtr m_GameObject m_Index m_IsArray m_IsStatic m_MetaFlag m_Name m_ObjectHideFlags m_PrefabInternal m_PrefabParentObject m_Script m_StaticEditorFlags m_Type m_Version Object pair PPtr<Component> PPtr<GameObject> PPtr<Material> PPtr<MonoBehaviour> PPtr<MonoScript> PPtr<Object> PPtr<Prefab> PPtr<Sprite> PPtr<TextAsset> PPtr<Texture> PPtr<Texture2D> PPtr<Transform> Prefab Quaternionf Rectf RectInt RectOffset second set short size SInt16 SInt32 SInt64 SInt8 staticvector string TextAsset TextMesh Texture Texture2D Transform TypelessData UInt16 UInt32 UInt64 UInt8 unsigned int unsigned long long unsigned short vector Vector2f Vector3f Vector4f m_ScriptingClassIdentifier Gradient ';

	let getString = (offset, type) => {
		if (offset < 0) {
			offset &= 0x7fffffff;
			return strings.substring(offset, strings.indexOf(' ', offset));
		} else if (offset < type.buffer_bytes) {
			let tmp = type.buffer_data.slice(offset, type.buffer_data.indexOf(0, offset));
			return String.fromCharCode.apply(null, tmp);
		} else {
			return undefined;
		}
	};

	let buildTypeTree = (type) => {
		// This makes assumptions about the order in which the nodes are serialized
		var parents = [type.node_data[0]];
		var curr;

		type.node_data.forEach((node) => {
			node.type = getString(node.typeOffset, type);
			node.name = getString(node.nameOffset, type);
			node.children = [];
			node.post_align = node.flags & 0x4000;

			if (node.depth == 0) {
				curr = node;
			} else {
				while (parents.length > node.depth) {
					parents.pop();
				}
				curr = node;
				parents[parents.length - 1].children.push(curr);
				parents.push(curr);
			}
		});
	};

	asset.typeStruct.types.forEach((type) => {
		buildTypeTree(type);
	});

	// Read the standard / built-in typetrees (not really needed for images)
	/*var standardTypes = typeStructParser.parse(fs.readFileSync('structs.dat'));
	standardTypes.types.forEach((type) => { buildTypeTree(type); });*/

	let parsedObjects = [];
	asset.objects.forEach((object, index) => {
		var type_tree = asset.typeStruct.types.find((type) => type.class_id == object.type_id);
		if (!type_tree) {
			type_tree = asset.typeStruct.types.find((type) => type.class_id == object.class_id);
			if (!type_tree) {
				//type_tree = standardTypes.types.find((type) => type.class_id == object.class_id);
				if (!type_tree) {
					console.error('Type tree not found for object ' + index + '; class id: ' + object.type_id);
					return undefined;
				}
			}
		}

		var objectBuffer = Buffer.from(
			bundle.assets.slice(asset.data_offset + object.data_offset /*, asset.data_offset + object.data_offset + object.size*/)
		);
		let parsedObject = read_value(object, type_tree.node_data[0], objectBuffer, 0).result;
		parsedObject.type = type_tree.node_data[0].type;

		parsedObjects.push(parsedObject);
	});

	// DONE parsing, now on to images

	let imageTexture = undefined;
	let hasSprites = false;
	let assetBundleManifest = undefined;
	parsedObjects.forEach((object) => {
		if (object.type == 'Texture2D') {
			if (object.m_TextureFormat != 10 && object.m_TextureFormat != 12) {
				console.error('Only supports DXT1 / DXT5 formats for images!');
				return undefined;
			}

			if (object.m_TextureFormat == 12) {
				object.rawBitmap = dxt.DXT5Decoder(object['image data'], object.m_Width, object.m_Height);
			} else {
				object.rawBitmap = dxt.DXT1Decoder(object['image data'], object.m_Width, object.m_Height);
			}
			delete object['image data'];
			console.assert(object.rawBitmap.length % 4 == 0);
			imageTexture = object;
		}
		if (object.type == 'Sprite') {
			hasSprites = true;
		}
		if (object.type == 'AssetBundleManifest') {
			if (!object.AssetBundleNames || !object.AssetBundleInfos || object.AssetBundleNames.length !== object.AssetBundleInfos.length) {
				throw Error('Invalid asset bundle manifest!');
			}

			const extractHashBytes = (assetBundleHash) => {
				let bytes = [];
				for (let ix = 0; ix < 16; ix++) {
					bytes.push(assetBundleHash[`bytes[${ix}]`]);
				}
				return bytes;
			}

			assetBundleManifest = [];
			for (let i = 0; i < object.AssetBundleNames.length; i++) {
				assetBundleManifest.push({
					name: object.AssetBundleNames[i].second,
					hash: extractHashBytes(object.AssetBundleInfos[i].second.AssetBundleHash),
					dependencies: object.AssetBundleInfos[i].second.AssetBundleDependencies,
				});
			}
		}
	});

	if (!imageTexture) {
		if (!assetBundleManifest) {
			console.log('No image in this asset bundle');

			if (!hasSprites) {
				//console.log(parsedObjects);
				return undefined;
			}
		} else {
			//let images = assetBundleManifest.filter(nm => nm.startsWith('images'));
			return { assetBundleManifest };
		}
	}

	var result = {
		imageName: imageTexture.m_Name,
		imageBitmap: {
			data: imageTexture.rawBitmap,
			width: imageTexture.m_Width,
			height: imageTexture.m_Height,
		},
		sprites: [],
	};

	if (hasSprites) {
		parsedObjects.forEach((object) => {
			if (object.type == 'Sprite') {
				console.assert(!object.m_IsPolygon, "Doesn't support polygonal sprites!");
				console.assert(object.m_Rect.x + object.m_Rect.width <= imageTexture.m_Width);
				console.assert(object.m_Rect.y + object.m_Rect.height <= imageTexture.m_Height);

				let spriteBitmap = Buffer.allocUnsafe(object.m_Rect.width * object.m_Rect.height * 4);
				for (let column = object.m_Rect.x; column < object.m_Rect.x + object.m_Rect.width; column++) {
					for (let row = object.m_Rect.y; row < object.m_Rect.y + object.m_Rect.height; row++) {
						let pixelLocation = (imageTexture.m_Height - 1 - row) * imageTexture.m_Width + column;
						imageTexture.rawBitmap.copy(
							spriteBitmap,
							((object.m_Rect.height - 1 - row + object.m_Rect.y) * object.m_Rect.width + (column - object.m_Rect.x)) * 4,
							pixelLocation * 4,
							(pixelLocation + 1) * 4
						);
					}
				}

				result.sprites.push({
					spriteName: object.m_Name,
					spriteBitmap: {
						data: spriteBitmap,
						width: object.m_Rect.width,
						height: object.m_Rect.height,
					},
				});
			}
		});
	}

	return result;
}

function parseAssetBundleManifest(data) {
	return parseAssetBundle(data, true);
}

module.exports = { parseAssetBundle, parseAssetBundleManifest };
