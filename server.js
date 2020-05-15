const nodemailer = require('nodemailer');
const https = require('https');
const fs = require('fs');
const config = require('./config');
const MS_PER_MINUTE = 60000;

const transporter = nodemailer.createTransport({
  name: config.mailName,
  host: config.mailHost,
  port: 587,
  secure: false
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

verify()
setInterval(verify, config.minutes * MS_PER_MINUTE);

function verify() {
  https.request(httpOptions, (response) => {
    if (config.logLevel === 'all') {
      console.log(new Date().toUTCString(), `http request to Blockcyper to get ${config.btcAddress} transactions info`);
    }
    let responseData = '';
    response.setEncoding('utf8');

    response.on('data', (chunk) => {
      responseData += chunk;
    });

    response.once('error', (err) => {
      if (config.logLevel !== 'silent') {
        console.error(new Date().toUTCString(), err);
      }
    });

    response.on('end', () => {
      try {
        if (config.logLevel === 'all') {
          console.log(new Date().toUTCString(), `http request to Blockcyper finished`);
        }
        const respJSON = JSON.parse(responseData);
        if (respJSON.txrefs) {
          const transactions = respJSON.txrefs;
          if (config.logLevel === 'all') {
            console.log(new Date().toUTCString(), `looking for transactions confirmed today`);
          }
          if (transactions.some(transaction => isToday(transaction.confirmed))) {
            if (config.logLevel === 'all') {
              console.log(new Date().toUTCString(), `there are transactions confirmed today`);
              console.log(new Date().toUTCString(), `verify if the user was already notified today`);
            }
            if (notified) {
              if (config.logLevel === 'all') {
                console.log(new Date().toUTCString(), `was notified today, I won't notify new transactions until tomorrow`);
              }
            } else {
              notified = true;
              if (config.logLevel === 'all') {
                console.log(new Date().toUTCString(), `trying to send an e-mail to ${config.mailTo} notifying new transactions today`);
              }
              transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                  if (config.logLevel !== 'silent') {
                    console.error(new Date().toUTCString(), err);
                  }
                } else {
                  if (config.logLevel === 'all') {
                    console.info(new Date().toUTCString(), 'Email sent: ' + info.response);
                  }
                }
              });
            }
          } else {  //reset the "notified" flag for the next day
            if (config.logLevel === 'all') {
              console.log(new Date().toUTCString(), `there are no transactions confirmed today, I will notify the next transaction that happens`);
            }
            notified = false;
          }
        } else {
          if (config.logLevel !== 'silent') {
            console.error(new Date().toUTCString(), respJSON);
          }
        }
        if (config.logLevel === 'all') {
          console.log(new Date().toUTCString(), `waiting ${config.minutes} minutes to verify again`);
        }
      } catch (e) {
        if (config.logLevel !== 'silent') {
          console.warn(new Date().toUTCString(), 'Could not parse response from options.hostname: ' + e);
        }
      }
    });
  }).end();
}

function isToday (date) {
  return new Date(date).toDateString() === new Date().toDateString();
}