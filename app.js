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
	cookieParser = require('cookie-parser'),
    nunjucks = require('nunjucks'),
    assert = require('assert'),
	basex  = require("basex"),
	convertToHierarchy = require("./data/navigation").convertToHierarchy,
	Database = require('./database').Database,
	cheerio = require('cheerio'),
	multer = require('multer'),
	upload = multer({dest:'./uploads/'}),
	fs = require('fs'),
	log = require('./debug'),
	session = require('express-session');


// Set up express
app = express();
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use('/static', express.static(__dirname + '/static'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({secret: 'ssshhhhh'}));

/*
 Configure nunjucks to work with express
 Not using consolidate because I'm waiting on better support for template inheritance with
 nunjucks via consolidate. See: https://github.com/tj/consolidate.js/pull/224
*/
var env = nunjucks.configure('views', {
    autoescape: true,
    express: app
});

var nunjucksEnv = new nunjucks.Environment();

env.addFilter('is_raw', function(str) {
  return str == 'raw';
});

env.addFilter('is_text', function(str) {
  return str == 'text';
});

env.addFilter('is_edit', function(str) {
  return str == 'edit';
});


var nunjucksDate = require('nunjucks-date');
nunjucksDate.setDefaultFormat('MMMM Do YYYY, h:mm:ss a');
env.addFilter("date", nunjucksDate);

    var router = express.Router();
	var database = new Database();
    // Homepage
    router.get("/", function(req, res) {
        "use strict";
        req.session.searchhistory=[];
		res.render('index', {isHomePage: true});
    });
    
    // Explore
    router.get("/explore", function(req, res) {
        "use strict";
		/*
		if nestedsearch 
		1. maintain a collection of previous {search : query, searchtype : searchtype} 
		2. a. when nested search is pressed, perform query using nested path
		2. a. 1. recursive function in database that 
		2. b. when normal search is pressed, clear the previous search history
		
		*/

		var searchtype = req.query.searchtype;
		var query = req.query.q;
		var searchhistory = {searchtype : searchtype, searchstring : query};
		
		if (req.query.nestedsearch && req.query.searchtype && req.query.q){
			req.session.searchhistory ? req.session.searchhistory.push(searchhistory) : req.session.searchhistory = [searchhistory];
		}else if (req.query.searchtype && req.query.q){
			req.session.searchhistory = [searchhistory];
		}else{
			//here we clear search history
			req.session.searchhistory=[];
		}
		console.log(req.session.searchhistory);
		//searchtype, query
		console.log("query: " + query);
		//if nested search then 
		
		searchandexplore(searchtype, query, req.session.searchhistory, req.query.nestedsearch,res);
    });
    
	router.get("/explore/:author", function(req, res){
		"use strict";
		req.session.searchhistory=[];
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
				//console.log(links);
		
				res.render('explore', {isHomePage: false, categories : author ? rootNode.children[author].children : rootNode.children,
				tableHeader : ["Type","Title"],
				"links" : links,
				breadcrumbs : {author: author}});
				
			});
			
		});
	});
	
	router.get("/explore/:author/:filetype", function(req, res){
		"use strict";
		req.session.searchhistory=[];
		var author = req.params.author;
		var filetype = req.params.filetype;
		
			database.getFileInfo(author+"/"+filetype, function(result){
				var $ = cheerio.load(result, { xmlMode: true });
				var links = [];
				$('link').each(function(i, elem){
					
					var path = $(elem).find('path').text();
					var title = $(elem).find('title').text();
					links.push({"path" : path, "title" : title});
				});
				//console.log(links);
				
				res.render('explore', {isHomePage: false,
					tableHeader : ["Title"],
					"links" : links,
					breadcrumbs : {author: author, type : filetype}});
				
			});
	});
	
	router.get("/explore/:author/:filetype/:filename", function(req, res){
		"use strict";
		req.session.searchhistory=[];
		var author = req.params.author;
		var filetype = req.params.filetype;
		var filename = req.params.filename;
		var doctype = req.query.doctype;

		viewFile(author, filetype, filename, doctype, res);
	});
    app.get("/contribute", function(req, res){
		"use strict";
		req.session.searchhistory=[];
		database.loadStructure(function(rootNode){
			res.render('contribute', {authors : rootNode.children, categories : ['diary', 'newspaper_letters', 'private_letters']});
		});
	});
	app.post("/upload",upload.single('file'), function(req,res,next){
		"use strict";
		req.session.searchhistory=[];
		console.log(req.body);
		console.log(req.file);
		var author = req.body.author ? req.body.author : req.body['author-selection']
		var category = req.body.category ? req.body.category : req.body['category-selection']
		var path = "/"+author + "/"+category + "/" + req.file.originalname;
		var s=fs.createReadStream(__dirname+ "/" + req.file.path);
		
		
		
		database.addFile(path, s, function(result){
			console.log(result);
			if (result.ok){
				viewFile(author, category, req.file.originalname, "text", res);
			}else{
				//res.render("contribute-result", {result:result});
				res.render("error", {err : {message : "Could not upload. Make sure xml file is TEI format and does not already exist!"}});
			}
		});
		
		
		
		
	});
	
	app.post("/edit", function(req, res){
		"use strict";
		req.session.searchhistory=[];
		//req.body.updatedfile
		console.log("EDIT POST -------");
		console.log(req.body.filepath);
		console.log(req.body.updatedfile);
		/*
		TODO: 
			xsd validate with schema
			Look at grunt xml to validate xml or basex 
			Look at zip.js
			Look at nested search
			
		*/
		
		database.updateFile(req.body.filepath, req.body.updatedfile, function(result){
			console.log(result);
			
			
			if (result.ok){
				var patharray = req.body.filepath.split("/");
				viewFile(patharray[0], patharray[1], patharray[2], "text", res);
			}else{
				//res.render("contribute-result", {result:result});
				res.render("error", {err : {message : "Could not upload. Make sure xml file is TEI format and does not already exist!"}});
			}
			
			//res.sendStatus(200); // equivalent to res.status(200).send('OK')
		});
		
		
		
	});
	
    // Use the router routes in our application
    app.use('/', router);

    // Start the server listening
    var server = app.listen(3000, function() {
        var port = server.address().port;
        console.log('Colenso Project listening on port %s.', port);
    });
	
	
var viewFile = function(author, filetype, filename, doctype, res){
	
	
	var maxChar = 25;
		if (!(doctype == "raw" || doctype == "text" || doctype == "edit")){
			doctype = "text";
		}
		if (doctype == "raw"){
			console.log("showing raw xml")
			//go to getFileRaw route and return whole document
			database.getFileRawToEdit(author+"/"+filetype+"/"+filename, function(result){
				var $ = cheerio.load(result, { xmlMode: true });
				var body = $.html();
				res.set('Content-Type','text/xml');
				res.send(body);
			});
		} else if (doctype == "edit"){
			
			database.getFileRawToEdit(author+"/"+filetype+"/"+filename, function(xml){
				var $ = cheerio.load(xml, { xmlMode: true });
				var body = $.html();
				database.getFileRawData(author+"/"+filetype+"/"+filename, function(result){
					var $ = cheerio.load(result, { xmlMode: true });					
					var filepath = $('result').find('path').text();
					var path = $('result').find('path').text().split("/");
					var title = $('result').find('title').text();
					var front = $('result').find('front').text();					
					
					var breadcrumbFilename = title.length > maxChar ? title.substring(0,maxChar) + "..." : title.substring(0,maxChar);
					console.log("filepath: " + filepath);
					console.log("body: " + body);
					res.render('edit', {title: title, front : front, body : body, breadcrumbs : {author: path[0], type: path[1], file : breadcrumbFilename},
									doctype : "edit", filepath : filepath});	
				});
	
			});
		}
		 else {
		
			database.getFile(author+"/"+filetype+"/"+filename, function(result){
				var $ = cheerio.load(result, { xmlMode: true });
				var filepath = $('result').find('path').text();
				var path = $('result').find('path').text().split("/");
				var title = $('result').find('title').text();
				var front = $('result').find('front').text();
				var body = $('result').find('body');
				
				
				var breadcrumbFilename = title.length > maxChar ? title.substring(0,maxChar) + "..." : title.substring(0,maxChar);
				
				res.render('view', {title: title, front : front, body : body, breadcrumbs : {author: path[0], type: path[1], file : breadcrumbFilename},
									doctype : "text", filepath : filepath});
					
				});
				
				//console.log(filetype ? rootNode.children[author].children[filetype].children : rootNode.children);
		}
}

searchandexplore = function(searchtype, query, searchhistory, isnestedsearch, res){
	
	if (isnestedsearch && searchhistory && searchhistory.length >= 1){
		/*
		if(not download)
		searchhistory has array of search history
		send searchhistory to database and that will create the search query
		
		then return 
		if (downlaodzip)
			perform query but get full xml of each file and send content-type :'application/zip'
		*/
		database.loadStructure(function(rootNode){
			database.nestedSearch(searchhistory, function(result){
				//here the links I will have will be that 
				var $ = cheerio.load(result, { xmlMode: true });
				var links = [];
				$('link').each(function(i, elem){
					
					var path = $(elem).find('path').text();
					var title = $(elem).find('title').text();
					var type = path.split('/')[1];
					var author = $(elem).find('author').text();
					links.push({"path" : path, "title" : title, "type" : type, "author" : author});
				});
				
				res.render('explore', {categories : rootNode.children,
					tableHeader : ["Author","Type","Title"],
					"links" : links,
					"query" : query,
					"zipdownload" : true,
					"hidequery" : true
					});
			})
		})
	}
	else if (searchtype == "text" && query){
			
		database.loadStructure(function(rootNode){
			database.textSearch(query, function(result){
				
				var $ = cheerio.load(result, { xmlMode: true });
				var links = [];
				$('link').each(function(i, elem){
					
					var path = $(elem).find('path').text();
					var title = $(elem).find('title').text();
					var type = path.split('/')[1];
					var author = $(elem).find('author').text();
					links.push({"path" : path, "title" : title, "type" : type, "author" : author});
				});
			
				res.render('explore', {categories : rootNode.children,
					tableHeader : ["Author","Type","Title"],
					"links" : links,
					"query" : query
					});
				
			});
		});
		
		} else if (searchtype == "markup" && query) {
			
			database.loadStructure(function(rootNode){
				database.markupSearch(query, function(result){
					
					var $ = cheerio.load(result, { xmlMode: true });
					var links = [];
					$('link').each(function(i, elem){
						
						var path = $(elem).find('path').text();
						var title = $(elem).find('title').text();
						var type = path.split('/')[1];
						var author = $(elem).find('author').text();
						links.push({"path" : path, "title" : title, "type" : type, "author" : author});
					});
					
					res.render('explore', {categories : rootNode.children,
						tableHeader : ["Author","Type","Title"],
						"links" : links,
						"query" : query
						});
					
				});
			});
		}else{
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
				
			
				res.render('explore', {categories : rootNode.children,
					tableHeader : ["Author","Type","Title"],
					"links" : links,
					"hideBreadcrumb":true
					});
				
			});
		});	
		}
}