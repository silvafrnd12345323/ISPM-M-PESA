require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const forge = require("node-forge");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

const apiKey = process.env.MPESA_API_KEY;
const serviceProviderCode = process.env.MPESA_SERVICE_PROVIDER_CODE;
const port = process.env.PORT || 3000;

const publicKey = fs.readFileSync("./public_key.pem", "utf8")
  .replace(/\r\n/g, "\n")
  .trim() + "\n";

function generateSecurityCredential(apiKey, publicKey) {
  const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
  const encrypted = publicKeyObj.encrypt(apiKey, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted);
}

app.get("/", (req, res) => {
  res.send("MPESA Backend Running");
});

app.post("/mpesa-payment", async (req, res) => {
  try {
    const { phone, amount, reference } = req.body;

    if (!phone || !amount || !reference) {
      return res.status(400).json({
        error: "missing fields",
        required: ["phone", "amount", "reference"]
      });
    }

    const securityCredential = generateSecurityCredential(apiKey, publicKey);

    const payload = {
      input_TransactionReference: String(reference),
      input_CustomerMSISDN: String(phone),
      input_Amount: String(amount),
      input_ThirdPartyReference: String(reference),
      input_ServiceProviderCode: String(serviceProviderCode)
    };

    console.log("PAYLOAD:", payload);

    const response = await axios.post(
      "https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/",
      payload,
      {
        headers: {
          Authorization: `Bearer ${securityCredential}`,
          "Content-Type": "application/json",
          Origin: "*"
        },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    console.log("MPESA STATUS:", response.status);
    console.log("MPESA DATA:", response.data);

    return res.status(response.status).json(response.data);
  } catch (error) {
    console.log("ERROR STATUS:", error.response?.status);
    console.log("ERROR DATA:", error.response?.data);
    console.log("ERROR MESSAGE:", error.message);

    return res.status(500).json({
      error: "payment failed",
      status: error.response?.status || 500,
      details: error.response?.data || error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});