# FlareDB 🔥
## Introduction:

FlareDb is an ongoing project  that focuses on simplicity and efficiency. It is intended to be a self hosted database where individuals will be able to host and use with ease. The purpose of  `FlareDb` is not to compete with the likes of `sqlite`, `mongodb` and so on but rather to aid our organisation [CodeTheEarth](https://github.com/CodeTheEarth)

## Features:
- JSON document based database (inspo from `mongodb`) 
- Single `.db` file database(inspo from `sqlite`)
- Indexing
- Ease of use
- Zero external dependencies
- Low ram usage (10k documents -> 38mb ram aproximately)
## Why Project FlareDB
Project flareDB as stated above is to aid our organisation [CodeTheEarth](https://github.com/CodeTheEarth) with a personal self hosted database to run our operations. That said, this is a completely open source project meaninig other developers can contribute, sponsor, take inspo from and self use for themselves >_<. This project should effectively solve the issues facing our organisation and other developers which relates to complexity of other databases and for some.. pricing.

## How to use?
First make sure you have node installed

- Installing dependency:
```
npm install https://github.com/codetheearth/flaredb
```
- Initializing a database
```
const db = new Flare("users.db");
await db.init();
```
- Creating a new document
```
const Users = db.collection("users", { name: "string", age: "number" }); //example schema
```
- Inserting into documents
```
await Users.put({ name: "Haki", age: 18 });
```
- Return whole document
```
const all = await Users.find();
console.log("All users:", all)
```
- Find one
```
const haki = await Users.findOne({ name: "Kaima" });
console.log("Find one:", haki.age);
```
- Update 
```
await Users.updateOne({ name: "Haki" }, { age: 19 }); // update first match
await Users.updateMany({ age: 20 }, { age: 21 }); // bulk update
```
- Delete
```
await Users.deleteOne({ name: "Kaima" }); // delete first match
await Users.deleteMany({ age: 21 }); // delete all matches
await Users.clear(); // wipe entire collection
```

### Contributors
- [Haki](https://github.com/hakisolos)
- [Kay](https://github.com/Kay-design3)
- [King david](https://github.com/KING-DAVIDX)
- [Xcelsama](https://github.com/Xcelsama)

### Other contributors
- [Astro](https://github.com/astrox11)

> CODE THE EARTH !!