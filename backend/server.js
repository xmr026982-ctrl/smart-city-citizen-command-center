require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const port = process.env.PORT || 4000;

connectDB()
  .then(() => app.listen(port, () => console.log(`issue api on ${port}`)))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });