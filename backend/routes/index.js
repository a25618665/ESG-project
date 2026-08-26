var express = require('express');
var router = express.Router();
const DBconnect = require("../DBconnect");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/company',function(req,res){
  const sql = "SELECT * FROM COMPANY";
  DBconnect.query(sql)
    .then(data=>{
      console.log(data)
      res.send(data)
    })
})

module.exports = router;
