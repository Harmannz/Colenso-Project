/*
	Copyright (c) 2016 Harman Singh
	
	Permission is hereby granted, free of charge, to any person, except one that is enrolled
	in SWEN303: User Interface Design at Victoria University of Wellington,
	obtaining a copy of this software and associated documentation files (the "Software"), 
	to deal in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.

*/


var express = require('express'),
    bodyParser = require('body-parser'),
    nunjucks = require('nunjucks'),
    assert = require('assert'),
	basex  = require("basex"),
	convertToHierarchy = require("./data/navigation").convertToHierarchy,
	Database = require('./database').Database,
	cheerio = require('cheerio');


// Set up express
app = express();
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use('/static', express.static(__dirname + '/static'));
app.use(bodyParser.urlencoded({ extended: true }));


/*
 Configure nunjucks to work with express
 Not using consolidate because I'm waiting on better support for template inheritance with
 nunjucks via consolidate. See: https://github.com/tj/consolidate.js/pull/224
*/
var env = nunjucks.configure('views', {
    autoescape: true,
    express: app
});

var nunjucksDate = require('nunjucks-date');
nunjucksDate.setDefaultFormat('MMMM Do YYYY, h:mm:ss a');
env.addFilter("date", nunjucksDate);

    var router = express.Router();
	var database = new Database();
    // Homepage
    router.get("/", function(req, res) {
        "use strict";
        
		res.render('index', {isHomePage: true});
    });
    
    // Explore
    router.get("/explore", function(req, res) {
        "use strict";
		
		database.loadStructure(function(rootNode){
			database.getFileInfo("", function(result){
				
				var $ = cheerio.load(result, { xmlMode: true });
				var links = [];
				$('link').each(function(i, elem){
					
					var path = $(elem).find('path').text();
					var title = $(elem).find('title').text();
					var type = path.split('/')[1];
					var author = $(elem).find('author').text();
					links.push({"path" : path, "title" : title, "type" : type, "author" : author});
				});
				console.log(links);
			
				res.render('explore', {isHomePage: false, categories : rootNode.children,
					tableHeader : ["Author","Type","Title"],
					"links" : links});
				
			});
		});	
    });
    
	router.get("/explore/:author", function(req, res){
		"use strict";
		var author = req.params.author;
		database.loadStructure(function(rootNode){
			database.getFileInfo(author, function(result){
				
				var $ = cheerio.load(result, { xmlMode: true });
				var links = [];
				$('link').each(function(i, elem){
					
					var path = $(elem).find('path').text();
					var title = $(elem).find('title').text();
					var type = path.split('/')[1];
					links.push({"path" : path, "title" : title, "type" : type});
				});
		
				res.render('explore', {isHomePage: false, categories : author ? rootNode.children[author].children : rootNode.children,
				tableHeader : ["Type","Title"],
				"links" : links,
				breadcrumbs : {author: author}});
				
			});
			
		});
	});
	
	router.get("/explore/:author/:filetype", function(req, res){
		"use strict";
		var author = req.params.author;
		var filetype = req.params.filetype;
		database.loadStructure(function(rootNode){
			database.getFileInfo(author+"/"+filetype, function(result){
				 var $ = cheerio.load(result, { xmlMode: true });
					var links = [];
					$('link').each(function(i, elem){
						
						var path = $(elem).find('path').text();
						var title = $(elem).find('title').text();
						links.push({"path" : path, "title" : title});
					});
					console.log(links);
				
					res.render('explore', {isHomePage: false,
						tableHeader : ["Title"],
						"links" : links,
						breadcrumbs : {author: author, type : filetype}});
					
				});
				
				//console.log(filetype ? rootNode.children[author].children[filetype].children : rootNode.children);
			});
	});
    
    // Use the router routes in our application
    app.use('/', router);

    // Start the server listening
    var server = app.listen(3000, function() {
        var port = server.address().port;
        console.log('Colenso Project listening on port %s.', port);
    });