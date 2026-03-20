import fs from "fs";
import path from "path";
import Emitter from "$lib/server/emitter";

const dataPathsUrl =
    "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/dataPaths.json";
const protocolUrl =
    "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/bedrock/{VERSION}/protocol.json";

let bedrockVersions: string[];

const bedrockPackets: Record<string, string[] | undefined> = {};
const appDataDir = process.env.APP_DATA_DIR ?? process.cwd();
const protocolDir = path.join(appDataDir, "protocol");

export async function init() {
    if (!fs.existsSync(protocolDir)) fs.mkdirSync(protocolDir, { recursive: true });

    const response = await (await fetch(dataPathsUrl)).json();
    bedrockVersions = Object.keys(response.bedrock);

    const files = fs.readdirSync(protocolDir);
    for (const file of files) {
        fs.readFile(path.join(protocolDir, file), undefined, (err, data) => {
            if (err) throw err;

            bedrockPackets[path.parse(file).name] = JSON.parse(data.toString());
        });
    }
}

export async function downloadPackets(version: string) {
    let packets: string[] = [];

    try {
        const response = await (await fetch(protocolUrl.replace("{VERSION}", version))).json();
        packets = Object.values(response.types.mcpe_packet[1][0].type[1].mappings);
    } catch (e) {
        console.error(e);
    }

    bedrockPackets[version] = packets;
    fs.writeFileSync(path.join(protocolDir, `${version}.json`), JSON.stringify(packets));

    Emitter.emit("protocol_downloaded", { version, packets });
}

export function getPackets(version: string) {
    return bedrockPackets[version];
}

export function getVersions() {
    return bedrockVersions;
}
