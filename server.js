const nodemailer = require('nodemailer');
const https = require('https');
const fs = require('fs');
const config = require('./config');
const MS_PER_MINUTE = 60000;

const transporter = nodemailer.createTransport({
  service: config.mailService ? config.mailService : 'gmail',
  auth: {
    user: config.mailUser,
    pass: config.mailPass
  },
  tls: {
    rejectUnauthorized: false
  }
});
const mailOptions = {
  from: config.mailFrom,
  to: config.mailTo,
  subject: 'BTC transaction made!',
  text: `Go check your account: https://live.blockcypher.com/btc/address/${config.btcAddress}/`
};
const httpOptions = {
  hostname: 'api.blockcypher.com',
  path: `/v1/btc/main/addrs/${config.btcAddress}`,
  method: 'GET'
};
let notified = false;

setInterval(verify, config.minutes * MS_PER_MINUTE);

function verify() {
  https.request(httpOptions, (response) => {
    let responseData = '';
    response.setEncoding('utf8');

    response.on('data', (chunk) => {
      responseData += chunk;
    });

    response.once('error', (err) => {
      console.error(err);
    });

    response.on('end', () => {
      try {
        const transactions = JSON.parse(responseData).txrefs;
        if (transactions.some(transaction => isToday(transaction.confirmed))) {
          if (!notified) {
            notified = true;
            //send mail
            transporter.sendMail(mailOptions, (err, info) => {
              if (err) {
                console.error(err);
              } else {
                console.info('Email sent: ' + info.response);
              }
            });
          }
        } else {  //reset the "notified" flag for the next day
          notified = false;
        }
      } catch (e) {
        console.warn('Could not parse response from options.hostname: ' + e);
      }
    });
  }).end();
}

function isToday (date) {
  return new Date(date).toDateString() === new Date().toDateString();
}