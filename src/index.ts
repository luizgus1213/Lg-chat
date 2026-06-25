import express from "express";
// import { Request, Response } from "express";
import { Server } from "socket.io";
import http from "http";

const app = express();

app.use(express.json());

//middleware  middle -> meio ware -> software

//middleware -> software que está no meio do caminho entre a requisição e a resposta

const middleware = (req: any, res: any, next: any) => {
  console.log("middleare foi executado");

  const params = req.query;

  if (params.aoba !== "1234") {
    return res.status(400).json({ mensagem: "Você não deu o aoba" });
  }

  next();
};

//localhost:4000/controller?aoba=aoba

app.get("/controller", middleware, (req, res) => {
  console.log("controller foi executado");
  res.json({ mensagem: "Aoba" });
});

app.get("/lalau", middleware, (req, res) => {
  console.log("controller foi executado");
  res.json({ mensagem: "Lalau" });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (connection) => {
  //começa a ouvir um evento
  console.log(`Um cliente se conectou com o id ${connection.id}`);

  connection.on("chat", (mensagem) => {
    //começa a ouvir um evento
    console.log(`O cliente ${connection.id} enviou a mensagem: ${mensagem}`);

    io.emit("chat", mensagem);
  });
});

server.listen(5000, () => {
  console.log("Servidor rodando na porta 5000");
});
