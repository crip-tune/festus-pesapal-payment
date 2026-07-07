const axios = require('axios');

exports.handler = async (event) => {
  const BASE_URL = "https://pay.pesapal.com/v3/api";
  const AUTH_URL = `${BASE_URL}/Auth/RequestToken`;
  const IPN_REG_URL = `${BASE_URL}/URLSetup/RegisterIPN`;
  const ORDER_URL = `${BASE_URL}/Transactions/SubmitOrderRequest`;

  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;

  // 🛑 SAFETY CHECK: Ensure keys are actually being loaded by Netlify
  if (!consumerKey || !consumerSecret) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: "Setup Error",
        message: "Your PesaPal keys are completely missing from your Netlify Environment Variables! Go to Netlify -> Site configuration -> Environment variables to add them."
      }, null, 2),
    };
  }

  try {
    // --- STEP A: AUTHENTICATION ---
    const authResponse = await axios.post(AUTH_URL, {
      consumer_key: consumerKey.trim(), // trims accidental spaces
      consumer_secret: consumerSecret.trim()
    }, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });

    const token = authResponse.data.token;

    // --- STEP B: REGISTER IPN ---
    const myHost = event.headers.host; 
    const myIpnUrl = `https://${myHost}/.netlify/functions/pesapal`;

    const ipnResponse = await axios.post(IPN_REG_URL, {
      url: myIpnUrl,
      ipn_notification_type: "GET"
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const ipnId = ipnResponse.data.ipn_id;

    // --- STEP C: CREATE CHECKOUT ORDER ---
    const orderPayload = {
      id: "ORDER_" + Math.floor(Math.random() * 1000000),
      currency: "KES",
      amount: 100.00,
      description: "Live Payment Integration Test",
      callback_url: myIpnUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: "testclient@example.com",
        phone_number: "0712345678",
        country_code: "KE",
        first_name: "Festus",
        last_name: "Developer"
      }
    };

    const orderResponse = await axios.post(ORDER_URL, orderPayload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: "Success! PesaPal LIVE API pipeline functional.",
        ipn_registered_url: myIpnUrl,
        ipn_id: ipnId,
        checkout_redirect_url: orderResponse.data.redirect_url,
        full_details: orderResponse.data
      }, null, 2),
    };

  } catch (error) {
    return {
      statusCode: error.response ? error.response.status : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: "Pipeline Failed",
        message: error.message,
        details: error.response ? error.response.data : null
      }, null, 2),
    };
  }
};
