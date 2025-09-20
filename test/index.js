import Flare from "../src/index.js";
async function main() {
  const db = new Flare("users.db");
  await db.init();

  const Users = db.collection("users", { name: "string", age: "number" });

  await Users.put({ name: "Haki", age: 18 });
  await Users.put({ name: "Kaima", age: 20 });

  const all = await Users.find();
  console.log("All users:", all);

  const haki = await Users.findOne({ name: "Kaima" });
  console.log("Find one:", haki.age);
}

main();
