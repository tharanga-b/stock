'use strict';
const mongoose = require('mongoose')

require('dotenv').config()

const { Schema, model } = mongoose

mongoose.connect(process.env.DB)

const ipSchema = new Schema({
  stock: { type: String, required: true },
  ips: {
    type: [String],
    required: false
  }
})

const ipModel = model('ipModel', ipSchema)

module.exports = function (app) {


  const checkDb = (stock) => new Promise(async (resolve, reject) => {
    try {
      const isExists = await ipModel.findOne({
        stock
      })
      resolve(isExists)
    } catch (e) {
      reject(e)
    }
  })

  const inserDb = function (dataList, like, ip, res) {
    let dbPromises = []
    dataList.forEach(element => {
      dbPromises.push(checkDb(element.symbol))
    })
    Promise.all(dbPromises, like).then(result => {
      let likes1 = 0
      let likes2 = 0
      result.forEach(async (item, num) => {
        if (item === null) {
          if (like) {
            await ipModel.create({
              stock: dataList[num].symbol,
              ips: [ip]
            })
          }
          num === 0 ? likes1 = 1 : likes2 = 1
        } else {
          if (!item.ips.includes(ip)) {
            item.ips.push(ip);
            await item.save();
            num === 0 ? likes1 = item.ips.length : likes2 = item.ips.length
          }
        }
      })
      if (result.length === 2) {
        res.json({ stockData: [{ stock: dataList[0].symbol, price: dataList[0].latestPrice, rel_like: likes1 }, { stock: dataList[1].symbol, price: dataList[1].latestPrice, rel_like: likes2 }] })
        return false
      } else {
        res.json({ stockData: { stock: dataList[0].symbol, price: dataList[0].latestPrice, rel_like: likes1 } })
        return false
      }
    })
  }

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      let { stock, like } = req.query
      if (stock.length === 2) {
        if (stock[0] === stock[1]) {
          stock = [stock[0]]
        }
      }
      const ip = req.socket.remoteAddress
      like === 'true' ? like = true : like = false
      let stocks = []
      let availablePromises = []
      if (typeof stock === 'object') {
        stock.map(item => stocks.push(item))
      } else {
        stocks.push(stock)
      }
      stocks.forEach(element => {
        availablePromises.push(new Promise(async (resolve, reject) => {
          try {
            let response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${element}/quote`)
            let result = await response.json()
            resolve(result)
          } catch (error) {
            if (error === 'Unknown symbol') {
              //TODO: add to a list
              res.json({ stockData: { error: "invalid symbol", likes: 0 } })
              return false
            }
          }
        }))
      })
      Promise.all(availablePromises).then(result => {
        let errors = ['Unknown symbol', 'Invalid symbol']
        result.forEach(item => {
          if (errors.includes(item)) {
            res.send({
              error: item
            })
            return false
          }
        })
        inserDb(result, like, ip, res)
      })
    });
}
