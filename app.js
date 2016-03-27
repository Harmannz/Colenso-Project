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
	archiver = require('archiver'),
	fs = require('fs'),
	log = require('./debug'),
	session = require('express-session'),
	deasync = require('deasync')
	store = require('json-fs-store')('./database/');


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
nunjucksDate.setDefaultFormat('YYYY-MM-Do, hh:mm:ss');
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

		var searchtype = req.query.searchtype;
		var query = req.query.q;
		var downloadZip = req.query.download ;
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
		
		searchandexplore(searchtype, query, req.session.searchhistory, req.query.nestedsearch, downloadZip, res);
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
	
	app.get("/stats", function(req,res){
		//query database to retrieve top 100 queries from searchtable database
		//query database to retrieve top 100 opened from opened database
		/* render statistics page with
			1. number of viewed
			2. number of uploads
			3. top 100 searchterms
			4. top 100 opened 
		*/
		
		res.render('statistics');
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
				//database.addUploadsToDatabase(path);
				store.remove('num-doc-uploaded', function(err, object){
					if (err) {console.log("Error getting num-doc-uploaded : " + err);}
					console.log(object);
					
					if (!object){
						//create upload object
						console.log("creating doc-uploaded");
						store.add({id:'num-doc-uploaded', count: 1});
					}else{
						console.log("updating doc-uploaded");
						
						var newCount = object.count + 1;
						console.log(newCount);
						store.add({id:'num-doc-uploaded', count: newCount});
						//increase count of existing upload object
					}
				});
				res.redirect("explore" + path);
				//viewFile(author, category, req.file.originalname, "text", res);
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
				//var patharray = req.body.filepath.split("/");
				res.redirect("explore/" + req.body.filepath);
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
				
				if (!filepath){
					res.status(500).render("error", {err : {message : "Invalid URL Request!"}});
				}{
					var breadcrumbFilename = title.length > maxChar ? title.substring(0,maxChar) + "..." : title.substring(0,maxChar);
					console.log("filepath: " + filepath);
					console.log("body: " + body);
					res.render('edit', {title: title, front : front, body : body, breadcrumbs : {author: path[0], type: path[1], file : breadcrumbFilename},
									doctype : "edit", filepath : filepath});	
									
				}
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
			
			if (!filepath){
				res.status(500).render("error", {err : {message : "Invalid URL Request!"}});
			}else {
				//add author, filetype, filename, path to database
				
				database.addOpenedFileToDatabase("/explore/" + filepath, author, filetype, title);
				var breadcrumbFilename = title.length > maxChar ? title.substring(0,maxChar) + "..." : title.substring(0,maxChar);			
				res.render('view', {title: title, front : front, body : body, breadcrumbs : {author: path[0], type: path[1], file : breadcrumbFilename},
									doctype : "text", filepath : filepath});			
			}
			
				
			});
			
			//console.log(filetype ? rootNode.children[author].children[filetype].children : rootNode.children);
	}
}

searchandexplore = function(searchtype, rawQuery, searchhistory, isnestedsearch, downloadZip, res){
	//var builtQuery = parseQuery(rawQuery);
	//console.log(rawQuery);
	if (isnestedsearch && searchhistory && searchhistory.length >= 1){
		/*
		if(not download)
		searchhistory has array of search history
		send searchhistory to database and that will create the search query
		
		then return 
		if (downloadzip)
			perform query but get full xml of each file and send content-type :'application/zip'
		*/
		if (downloadZip){
			var zipfilename = "colenso-docs.zip";
			
			var archive = archiver('zip');

			archive.on('error', function(err) {
				res.status(500).send({error: err.message});
			});

			//on stream closed we can end the request
			archive.on('end', function() {
				console.log('Archive wrote %d bytes', archive.pointer());
			});

			//set the archive name
			res.attachment(zipfilename);
			
			//this is the streaming magic
			archive.pipe(res);
			
			var paths = [];
			//get 
			database.getNestedQueryPaths(searchhistory, function(result){
				//here the links I will have list of db:paths 
				var $ = cheerio.load(result, { xmlMode: true });
				
				$('link').each(function(i, elem){
					
					paths.push($(elem).find('path').text());
					
				});
								
				//here for each db:path split into author, filetype, filename
				
				for (var i = 0; i < paths.length; i++){
					var filename = paths[i].split('/')[2];
					var body = null;
					var done = false;
					//do following until body != null after that archive.append
					database.getFileRawToEdit(paths[i], function(result){
						var $ = cheerio.load(result, { xmlMode: true });
						body = $.html();
						done = true;						
					});
					deasync.loopWhile(function(){return !done;});
					archive.append(body, {name : filename})
					
				}
				
				
				archive.finalize();
				
			});

		}else{
			//Perform Nested Search
			database.loadStructure(function(rootNode){
				database.nestedSearch(searchhistory, function(result){
					
					var $ = cheerio.load(result, { xmlMode: true });
					var links = [];
					$('link').each(function(i, elem){
						
						var path = $(elem).find('path').text();
						var title = $(elem).find('title').text();
						var type = path.split('/')[1];
						var author = $(elem).find('author').text();
						links.push({"path" : path, "title" : title, "type" : type, "author" : author});
					});
					
					//get array of searchhistory.searchstring
					var nestedQueries = [];
					for (var i = 0; i < searchhistory.length; i++){
						nestedQueries.push(searchhistory[i].searchstring);
					}
					res.render('explore', {categories : rootNode.children,
						tableHeader : ["Author","Type","Title"],
						"links" : links,
						"query" : nestedQueries,
						"isNestedQuery" : true,
						"hidequery" : true
						});
				});
			});
		}
	}
	else if (searchtype == "text" && rawQuery){
		//parse the text search format : "text" AND/OR/NOT "  ";
		//do not parse : "AND/OR/NOT" 
		/*
		1. split 	
		parse through characters in query.
		if (") then continue until next (") or end of string
		if (AND/OR/NOT) then convert to ftand/ftor/ftnot
		
		*/
		//query = parseQuery(query);
		database.loadStructure(function(rootNode){
			database.textSearch(rawQuery, function(result){
				
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
					"query" : [rawQuery]
					});
				
			});
		});
		
		} else if (searchtype == "markup" && rawQuery) {
			
			database.loadStructure(function(rootNode){
				database.markupSearch(rawQuery, function(result){
					
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
						"query" : [rawQuery]
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


parseQuery = function(rawQuery){
	
	var regex = /\"[^"]*"| *([^"]*)/g
	if (rawQuery){
		var replace = rawQuery.replace(regex, function(match, p1)
		{
			if (p1 == undefined){
				return match;
			}else{
				var operators = p1.split(" ");
				for (var i = 0; i < operators.length ; i++){
					var operator = operators[i];
					operator.toLowerCase() == "and" ? operators[i] = "ftand" : '';
					operator.toLowerCase() == "or" ? operators[i] = "ftor" : '';
					operator.toLowerCase() == "not" ? operators[i] = "ftnot" : '';
				}
				
				p1 = " "+ operators.join(" ");			
				return p1;
			}
		});
		return replace;
	} else{
		return rawQuery;
	}
}

/*
testParser = function(){
	var index = 0;
	var query;
	
	this.parseQuery = function(query){
		this.query = query;
		while (this.index < this.query.length){
			this.evaluateNextCommand();
		}
	},
	this.evaluateNextCommand = function(){
		//if query[index] == " then readWord
		//if query[index : index+1] == ft then read operator and convert
		this.skipWhiteSpace();
		if (query[index] == '"'){
			index = index + 1;
			this.skipKeywords();
		}
		var operation = this.readWord();
	} ,
	this.skipWhiteSpace = function(){
		while (index < query.length && query[index] == " "){
			index = index + 1;
		}
	},
	this.readWord = function(){
		var start = index;
		while(index < query.length && query[index]){
			index = index + 1;
		}
		//this should contain text such as AND/OR/NOT or other operators.
		
		return query.substring(start, index);
		
	},
	
	this.skipKeywords = function(){
		while(index < query.length && query[index] != '"'){
			index = index + 1;
		}
	}
	
	
	
}

*/