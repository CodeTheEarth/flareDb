import Flare from "../src/index.js";
async function main() {
  const db = new Flare("users.db");
  await db.init();

  const Users = db.collection("users", { name: "string", age: "number" });

  await Users.put({ name: "Haki", age: 18 });
  await Users.put({ name: "Kaima", age: 20 });
  const haki = await Users.findOne({name: "Haki"})
  console.log(`former user ${haki} `)
  await Users.updateOne({name: "Haki"}, {name: "shell D. haki"})
  console.log("newuser: ", haki)
}

main();
