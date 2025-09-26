import { FlareCache } from "../dist/index.js";

async function main() {
  const cache = new FlareCache()
  await cache.set("name", "haki")
  console.log(cache.get("name"))
}

main().catch(console.error);