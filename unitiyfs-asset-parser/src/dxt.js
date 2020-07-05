// "polyfill" Buffer
var self = (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
self.Buffer = self.Buffer ? self.Buffer : require('buffer/').Buffer;
var Buffer = self.Buffer;

// Adapted from https://github.com/jangxx/node-s3tc
function decodeDXT5(in_buf, pos, buffer, width, height, currentY, currentX) {
    var alpha0 = in_buf.readUInt8(pos + 0, true);
    var alpha1 = in_buf.readUInt8(pos + 1, true);
    var a_raw = [in_buf.readUInt8(pos + 2, true), in_buf.readUInt8(pos + 3, true), in_buf.readUInt8(pos + 4, true), in_buf.readUInt8(pos + 5, true), in_buf.readUInt8(pos + 6, true), in_buf.readUInt8(pos + 7, true)];
    var color0 = RGB565_to_RGB888(in_buf.readInt16LE(pos + 8, true));
    var color1 = RGB565_to_RGB888(in_buf.readInt16LE(pos + 10, true));
    var c = [in_buf.readUInt8(pos + 12, true), in_buf.readUInt8(pos + 13, true), in_buf.readUInt8(pos + 14, true), in_buf.readUInt8(pos + 15, true)];

    var a = [
        0x7 & (a_raw[0] >> 0),
        0x7 & (a_raw[0] >> 3),
        0x7 & (((0x1 & a_raw[1]) << 2) + (a_raw[0] >> 6)),
        0x7 & (a_raw[1] >> 1),
        0x7 & (a_raw[1] >> 4),
        0x7 & (((0x3 & a_raw[2]) << 1) + (a_raw[1] >> 7)),
        0x7 & (a_raw[2] >> 2),
        0x7 & (a_raw[2] >> 5),
        0x7 & (a_raw[3] >> 0),
        0x7 & (a_raw[3] >> 3),
        0x7 & (((0x1 & a_raw[4]) << 2) + (a_raw[3] >> 6)),
        0x7 & (a_raw[4] >> 1),
        0x7 & (a_raw[4] >> 4),
        0x7 & (((0x3 & a_raw[5]) << 1) + (a_raw[4] >> 7)),
        0x7 & (a_raw[5] >> 2),
        0x7 & (a_raw[5] >> 5)
    ];

    for (var i = 0; i < 16; i++) {
        var e = Math.floor(i / 4); //current element

        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 0] = c2value(3 & c[e], color0.r, color1.r); //red
        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 1] = c2value(3 & c[e], color0.g, color1.g); //green
        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 2] = c2value(3 & c[e], color0.b, color1.b); //blue
        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 3] = a2value(a[i]); //alpha

        c[e] = c[e] >> 2;
    }

    function c2value(code, color0, color1) {
        switch (code) {
            case 0: return color0;
            case 1: return color1;
            case 2: return (color0 + color1 + 1) >> 1;
            case 3: return (color0 + color1 + 1) >> 1;
        }
    }

    function a2value(code) {
        if (alpha0 > alpha1) {
            switch (code) {
                case 0: return alpha0;
                case 1: return alpha1;
                case 2: return (6 * alpha0 + 1 * alpha1) / 7;
                case 3: return (5 * alpha0 + 2 * alpha1) / 7;
                case 4: return (4 * alpha0 + 3 * alpha1) / 7;
                case 5: return (3 * alpha0 + 4 * alpha1) / 7;
                case 6: return (2 * alpha0 + 5 * alpha1) / 7;
                case 7: return (1 * alpha0 + 6 * alpha1) / 7;
                default: console.log(code);
            }
        } else {
            switch (code) {
                case 0: return alpha0;
                case 1: return alpha1;
                case 2: return (4 * alpha0 + 1 * alpha1) / 5;
                case 3: return (3 * alpha0 + 2 * alpha1) / 5;
                case 4: return (2 * alpha0 + 3 * alpha1) / 5;
                case 5: return (1 * alpha0 + 4 * alpha1) / 5;
                case 6: return 0;
                case 7: return 255; //why, what, WHY???
                default: console.log(code);
            }
        }
    }
}

function decodeDXT1(in_buf, pos, buffer, width, height, currentY, currentX) {
    var color0 = RGB565_to_RGB888(in_buf.readInt16LE(pos + 0));
    var color1 = RGB565_to_RGB888(in_buf.readInt16LE(pos + 2));
    var c = [in_buf.readUInt8(pos + 4), in_buf.readUInt8(pos + 5), in_buf.readUInt8(pos + 6), in_buf.readUInt8(pos + 7)];

    for (var i = 0; i < 16; i++) {
        var e = Math.floor(i / 4); //current element

        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 0] = c2value(3 & c[e], color0.r, color1.r); //red
        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 1] = c2value(3 & c[e], color0.g, color1.g); //green
        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 2] = c2value(3 & c[e], color0.b, color1.b); //blue
        buffer[width * 4 * (height - 1 - currentY - e) + 4 * currentX + ((i - (e * 4)) * 4) + 3] = 255; //alpha

        c[e] = c[e] >> 2;
    }

    function c2value(code, color0, color1) {
        if (color0 > color1) {
            switch (code) {
                case 0: return color0;
                case 1: return color1;
                case 2: return (2 * color0 + color1) / 3;
                case 3: return (color0 + 2 * color1) / 3;
            }
        } else {
            switch (code) {
                case 0: return color0;
                case 1: return color1;
                case 2: return (color0 + color1 + 1) >> 1;
                case 3: return (color0 + color1 + 1) >> 1;
            }
        }
    }
}

function DXTDecoder(chunk, width, height, chunkDecoder, chunkSize) {
    var buffer = Buffer.allocUnsafe(width * height * 4);
    var currentX = 0;
    var currentY = 0;

    var pos = 0;
    while (pos < chunk.length) {
        if (currentX == width && currentY == height) break;

        chunkDecoder(chunk, pos, buffer, width, height, currentY, currentX);

        currentX += 4;
        if (currentX + 4 > width) {
            currentX = 0;
            currentY += 4;
        }

        pos += chunkSize;
    }

    return buffer;
}

function DXT5Decoder(chunk, width, height) {
    return DXTDecoder(chunk, width, height, decodeDXT5, 16);
}

function DXT1Decoder(chunk, width, height) {
    return DXTDecoder(chunk, width, height, decodeDXT1, 8);
}

module.exports = { DXT1Decoder, DXT5Decoder };

function RGB565_to_RGB888(rgb) {
    return {
        r: ((rgb & 0b1111100000000000) >> 11) * 8,
        g: ((rgb & 0b0000011111100000) >> 5) * 4,
        b: (rgb & 0b0000000000011111) * 8
    };
} 