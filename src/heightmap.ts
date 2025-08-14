import fs from 'fs';
import { PNG } from 'pngjs';

require('dotenv').config();
interface HeightInfo {
    symbol: string;
    short_name: string;
    name: string;
    height: number;
    empty: number;
    low: boolean;
}

async function getHeightInfo(file: string) {
    return new Promise<HeightInfo>((resolve, reject) => {
        let info: HeightInfo = {
            symbol: '',
            short_name: '',
            name: '',
            height: 0,
            empty: 0,
            low: false
        }

        let height = 0;
        let empty = 0;

        try {
            fs.createReadStream(file)
                .pipe(new PNG())
                .on('parsed', function () {
                    height = this.height;
                    for (let y = 0; y < this.height; y++) {
                        const rowStart = y * this.width * 4;
                        let x = 0;
                        for (x = 0; x < this.width; x++) {
                            const idx = rowStart + x * 4;
                            const r = this.data[idx];
                            const g = this.data[idx + 1];
                            const b = this.data[idx + 2];
                            const a = this.data[idx + 3];
                            if (a) {
                                break;
                            }
                        }
                        if (x === this.width) empty++;
                        else break;
                    }
                    info.height = height;
                    info.empty = empty;
                    resolve(info);
                });
        }
        catch (e: any) {
            reject(e);
        }
    });
}


async function processCrewImages(refresh = false) {
    console.log("Computing image heights...");
    const crewfile = '../website/static/structured/crew.json';
    const crew = JSON.parse(fs.readFileSync(crewfile, 'utf-8')) as { symbol: string, imageUrlFullBody: string, name: string, short_name: string }[];
    const imagePath = `${process.env.OUT_PATH}/assets`;
    const heightFile = `${imagePath}/height_info.json`;

    const imgmap = crew.map(c => ({ symbol: c.symbol, image: c.imageUrlFullBody }));

    const infoOut = (() => {
        if (!refresh && fs.existsSync(heightFile)) {
            return JSON.parse(fs.readFileSync(heightFile, 'utf-8')) as HeightInfo[];
        }
        else {
            return [] as HeightInfo[];
        }
    })();

    for (let file of fs.readdirSync(imagePath)) {
        let cref = imgmap.find(f => f.image === file);
        if (!cref) continue;
        let c = crew.find(f => f.symbol === cref!.symbol);
        if (!c) continue;
        if (!refresh) {
            let curr = infoOut.find(f => f.symbol === cref!.symbol);
            if (curr) continue;
        }
        let info = await getHeightInfo(`${imagePath}/${file}`);
        info.symbol = c.symbol;
        info.short_name = c.short_name;
        info.name = c.name;
        info.low = info.empty >= 300;
        infoOut.push(info);
    }
    fs.writeFileSync(`${imagePath}/height_info.json`, JSON.stringify(infoOut, null, 4));
}


(async () => {
    let refresh = process.argv.includes("--refresh");
    await processCrewImages(refresh);
})();