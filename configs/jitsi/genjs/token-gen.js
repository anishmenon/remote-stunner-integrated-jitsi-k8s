const jwt = require("jsonwebtoken");

console.log(jwt.sign({
    iss: "meetmo",
    aud: "meetmo",
    sub: "media0.cluster.meetmo.io",
    room: "*",
    context: {
      user: {
        id: "24",
        name: "Johan Romaro",
        email: "johan@meetmo.io",
        affiliation: "owner",
      }
    },

  }, "A12988E22EA99EA22B97BD634FDE31CC5A3C48D96B544329B7AD3C84E7A06398"))