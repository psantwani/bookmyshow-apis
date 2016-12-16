var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var apicache = require('apicache').options({ debug: true }).middleware;
var engines = require('consolidate');
var path = require('path');
var cheerio = require('cheerio');

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
app.use(express.static(path.join(__dirname, 'public')));
app.set('json spaces', 40);
app.set('views', __dirname + '/views');
app.engine('html', engines.mustache);
app.set('view engine', 'html');

app.listen(process.env.PORT || 61616, function(){
	console.log('Listening on heroku');
});

app.get('/', function(req,res){
	res.render('./index.html');
});

app.get('/movies', apicache('1 hour'), function(req, res){	
	movieList('', '', function(data){	
		if(data !== "No data found"){
			var movieList = [];
			data.forEach(function(product, i, data){
				movieList.push(product.ecommerce.click.products[0]);
				if(i == data.length - 1){
					res.json(movieList);		
				}
			});	
		}	
		else{
			res.json(data);
		}		
	});
});

app.get('/venueList', apicache('1 day'), function(req, res){
	venueList(function(data){
		res.send(data);	
	});	
});

app.get('/region', apicache('1 day'), function(req, res){
	regions(function(data){
		res.send(data);
	});
});


app.get('/:city/movies', apicache('1 hour'), function(req, res){
	var city = req.params.city.toLowerCase() + "/";
	movieList(city, '', function(data){
		if(data !== "No data found"){
			var movieList = [];
			data.forEach(function(product, i, data){
				movieList.push(product.ecommerce.click.products[0]);
				if(i == data.length - 1){
					res.json(movieList);		
				}
			});	
		}	
		else{
			res.json(data);
		}		
	});	
});

app.get('/movies/:movie_name/:movie_code', function(req, res){
	var movie_name = req.params.movie_name.toLowerCase();
	var movie_code = req.params.movie_code.toUpperCase();
	movieInfo(movie_name, movie_code, function(data){
		res.json(data);
	});
});

app.get('/:city/buytickets/:movie_name/:movie_code/:date', function(req, res){
	var city = req.params.city.toLowerCase();
	var movie_name = req.params.movie_name.toLowerCase();
	var movie_code = req.params.movie_code.toUpperCase();
	var date = req.params.date;
	showtimes(city, movie_name, movie_code, date, function(data){
		res.send(data);
	});
});

function showtimes(city, movie_name, movie_code, date, callback){
	movie_name = movie_name.replace(/[^a-zA-Z ]/g, "");
	movie_name = movie_name.replace(" ","-");
	getCityCode(city, function(city_code){
		request('https://in.bookmyshow.com/buytickets/' + movie_name + '-' + city + "/movie-" + city_code + "-" + movie_code + "-MT/" + date  , function (error, response, body) {
		  	if (!error && response.statusCode == 200) {
		  		var pattern = 'var aST_details  =   .*';
		  		regExFunction(pattern, body, function(res){
		  			if(res){	  				
		  				var movieList = JSON.parse(res.split("var aST_details  =   JSON.parse('")[1].replace(/'/g, "").slice(0,-2));		  				
		  				return callback(movieList);
		  			}
		  			else{	  				
		  				return callback("No data found");
		  			}  			
		  		});	  		
		  	}
		});
	});
}

function getCityCode(city, callback){
	return callback("mumbai");
}


function movieList(city, filter, callback){	
	request('https://in.bookmyshow.com/' + city + 'movies' + filter, function (error, response, body) {
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

function venueList(callback){
	var url = "http://in.bookmyshow.com/cinemas";
	request(url, function(err, response, body){
		let $ = cheerio.load(body);
		var venues = [];
		var movies = $(".__cinema-text > a");
		for(let key in movies){
			if(!isNaN(key)){			
				var venue = {};
				var movie = movies[key];
				var href = movie.attribs.href;
				var name = movie.children[0].data;				
				venue["name"] = name;
				venue["code"] = href.slice(-4);
				venues.push(venue);
			}
		}
		//console.log(venues);
		return callback(venues)
	});
}


function regions(callback){
	var url = "https://in.bookmyshow.com/serv/getData/?cmd=GETREGIONS";
	request(url, function(err, response, body){
		var pattern = 'var regionlst={(.*)}';
		var regionsInfo = [];
		regExFunction(pattern, body, function(res){			
			res = res.toString();
			if(res){				
				var abc = res.split("var regionlst=");
				console.log("Result");
				//console.log(abc[1])
				var text = abc[1];
				var pqr = text.split(";var regionalias=[");
				var regions = pqr[0];


				//console.log(JSON.parse(regions));

				regions = JSON.parse(regions);

				for(key in regions){
					
					subregions = regions[key];
					for(var i = 0 ; i < subregions.length; i++){
						var subregion = subregions[i];
						subregion["state"] = key;
						regionsInfo.push(subregion);
					}
				}

				return callback(regionsInfo);
			}
			else{
				return callback("No data found");
			}
		});
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