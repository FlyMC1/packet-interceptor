const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..", "node_modules", "prismarine-nbt");
const legacyEntry = path.join(packageRoot, "zigzag.js");
const renamedEntry = path.join(packageRoot, "compiler-zigzag.js");

if (!fs.existsSync(packageRoot) || !fs.existsSync(renamedEntry)) {
    process.exit(0);
}

fs.writeFileSync(
    legacyEntry,
    [
        "const compiler = require('./compiler-zigzag');",
        "",
        "module.exports = {",
        "    compiler,",
        "    interpret: {",
        "        zigzag32: [compiler.Read.zigzag32[1], compiler.Write.zigzag32[1], compiler.SizeOf.zigzag32[1]],",
        "        zigzag64: [compiler.Read.zigzag64[1], compiler.Write.zigzag64[1], compiler.SizeOf.zigzag64[1]]",
        "    }",
        "};",
        ""
    ].join("\n"),
    "utf8"
);

console.log("Created prismarine-nbt compatibility shim: zigzag.js");