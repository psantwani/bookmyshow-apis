var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var apicache = require('apicache').options({ debug: true }).middleware;

var $;
require("jsdom").env("", function(err, window) {
    if (err) {
        console.error(err);
        return;
    }
    $ = require("jquery")(window);
});

var app = new express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('json spaces', 40);

app.listen('9000', function(){
	console.log('Listening on port 9000');
});

app.get('/', function(req,res){
	res.send("Magic happens at BookMyShow.");
});

app.get('/movies', apicache('1 hour'), function(req, res){	
	movieList('', function(data){		
		res.json(data);
	});
});

app.get('/:city/movies', apicache('1 hour'), function(req, res){
	var city = req.params.city.toLowerCase() + "/";
	movieList(city, function(data){
		res.json(data);
	});	
});

app.get('/movies/:movie_name/:movie_code', function(req, res){
	var movie_name = req.params.movie_name.toLowerCase();
	var movie_code = req.params.movie_code.toUpperCase();
	movieInfo(movie_name, movie_code, function(data){
		res.json(data);
	});
});

function movieList(city, callback){
	request('https://in.bookmyshow.com/' + city + 'movies', function (error, response, body) {
	  	if (!error && response.statusCode == 200) {
	  		var pattern = 'var productClickArray = .*';
	  		regExFunction(pattern, body, function(res){
	  			if(res){	  				
	  				var movieList = JSON.parse(res.split("var productClickArray = ")[1].replace(/'/g, "").slice(0,-1));
	  				return callback(movieList);
	  			}
	  			else{	  				
	  				return callback("No data found");
	  			}  			
	  		});	  		
	  	}
	});
}

function movieInfo(movie_name, movie_code, callback){
	movie_name = movie_name.replace(/[^a-zA-Z ]/g, "");
	movie_name = movie_name.replace(" ","-");
	request("https://in.bookmyshow.com/movies/" + movie_name + "/" + movie_code, function (error, response, body) {
		var pattern = 'var analyticsObj = {(.*?)}';
		regExFunction(pattern, body, function(res){
			if(res){				
				var movieInfo = JSON.parse(res.split("var analyticsObj = ")[1].replace(/'/g, ""));	
				movieInfo["picture_url"] = "http://in.bmscdn.com/events/moviecard/" + movie_code + ".jpg";
				movieInfo["showcase_url"] = "https://in.bmscdn.com/events/showcasesynopsis/" + movie_code + ".jpg";
				return callback(movieInfo);
			}
			else{
				return callback("No data found");
			}
		});
	});
}

function regExFunction(pattern, myString, callback){
	var regexp = new RegExp(pattern);
	var res = myString.match(regexp);
	if(res !== null){
		return callback(res[0]);
	}
	else{
		return callback(false);
	}
}