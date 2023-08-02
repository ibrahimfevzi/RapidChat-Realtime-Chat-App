const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

require("dotenv").config();

const mongoDbConnection = require("./helpers/mongoDbConnection")();
const TableMessage = require("./models/Message");

app.use(express.static("public"));

// Bu adresi ziyaret eden kullancılar index.html sayfasını görüntüleyecek
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Uygulama içerisindeki tüm aktif kullanıcılar burada tutulacak
let allUsers = [];

// Kullanıcı bağlandığı an otomatik bir kullanıcı adıyla listeye eklenecek, daha sonrasında kullanıcı ismini değiştirebilir
io.on("connection", (socket) => {
  allUsers.push({
    id: socket.id,
    username: "default",
    room_id: "0",
  });

  // Uygulama içerine kaç kullanıcının olduğu bilgisi gönderildi
  io.emit("total_user_count", allUsers.length);

  // Kullanıcının Odaya Katılma işleminde kullanıcının kullanıcı adı ve katılmak istediği oda güncellenir
  socket.on("join_room", (msg) => {
    let findIndex = allUsers.findIndex((item) => item.id === socket.id);
    allUsers[findIndex] = {
      id: socket.id,
      username: msg.username,
      room_id: msg.room_id,
    };

    // Kullanıcı burada odaya katılır
    socket.join(msg.room_id);

    // Odadaki kullanıcılara odanın içerisindekiler gönderilir

    io.in(msg.room_id).emit(
      "room_users",
      allUsers.filter((x) => x.room_id == msg.room_id)
    );

    // Odaya katılan kullanıcıya oda içerisindeki eski mesajlar gönderilir
    TableMessage.find({
      roomId: msg.room_id,
    })
      .then((messages) => {
        io.to(socket.id).emit("old_messages", messages);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  // Kullanıcıların oda içerisindekilere mesaj gönderme işlemi
  socket.on("send_message", (msg) => {
    io.in(msg.room_id).emit("send_message", msg);
    new TableMessage({
      content: msg.message,
      roomId: msg.room_id,
      username: msg.username,
    }).save();
  });

  // Kullanıcı çıkış yaptığı an kullanıcılar listesinden çıkartılacak ve ekrana yeni kullanıcı sayısı gönderilecek
  socket.on("disconnect", () => {
    let removeIndex = allUsers.findIndex((item) => item.id === socket.id);
    let findRoomId = allUsers[removeIndex].room_id;
    allUsers.splice(removeIndex, 1);

    io.emit("total_user_count", allUsers.length);
    io.in(findRoomId).emit(
      "room_users",
      allUsers.filter((x) => x.room_id == findRoomId)
    );
  });
});

// Uygulama 3000 portu üzerinden çalışacaktır
server.listen(3000, () => {
  console.log("listening on *:3000");
});
