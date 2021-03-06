const axios = require('axios');
const config = require('./config');
const db = require('namshi-node-mysql')(config.db);
const _ = require('lodash');

async function getExternal(fromCurrency, toCurrency, onDate) {
  let rate = 0;
  const fromToCurrency = `${fromCurrency}_${toCurrency}`;
  const response = await axios.get(
    `${config.currencyConverterApiBaseUrl}/convert?q=${fromToCurrency}&compact=ultra&date=${onDate}`      
  );
  rate = _.get(response,`data[${fromToCurrency}][${onDate}]`, 0);

  if(rate === 0) {
    throw new Error(`Error in fetching rate`);
  }
  db.query(
    `INSERT INTO exchange_rates (from_currency, to_currency, rate, on_date) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rate = ?`,
    [fromCurrency, toCurrency, rate, onDate, rate]
  ).then(result => {
    if(result.affectedRows === 0) {
      console.error(`Exchange rate of ${rate} for ${fromCurrency} to ${toCurrency} on ${onDate} could not be saved`)
    }
  }); //this is done async for the API to respond faster
 
  console.log(`Fetched exchange rate of ${rate} for ${fromCurrency} to ${toCurrency} of ${onDate} from the API`);
  return {fromCurrency, toCurrency, onDate, rate};
}

async function get(params) {
  const today = new Date().toISOString().split('T')[0];
  const {fromCurrency='AUD', toCurrency='USD', onDate=today} = params;

  let exchangeRate = await db.query(
    `SELECT rate, created_at FROM exchange_rates WHERE from_currency = ? AND to_currency = ? AND on_date = ?`, 
    [fromCurrency, toCurrency, onDate]
  );
    
  if (exchangeRate.length) {
    const rate = Number(exchangeRate[0].rate);
    console.log(`Found exchange rate of ${rate} for ${fromCurrency} to ${toCurrency} of ${onDate} in the db`);
    return {fromCurrency, toCurrency, onDate, rate};
  }
  
  return getExternal(fromCurrency, toCurrency, onDate);
}

module.exports = {
  get
}
