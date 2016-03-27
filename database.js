
var basex  = require("basex"),
	convertToHierarchy = require("./data/navigation").convertToHierarchy,
	assert = require('assert'),
	log = require('./debug'),
	Readable = require('stream').Readable,
	fs = require('fs'),
	sqlite3 = require("sqlite3").verbose();
	
//Setup sqlite database
var dbFile = './database/test.db';
var dbExists = fs.existsSync(dbFile);
	
if(!dbExists){
	console.log("Creating DB file.");
	fs.openSync(dbFile, "w");
}

//initialise the database:
var db = new sqlite3.Database(dbFile);
db.serialize(function(){
	
	db.parallelize(function() {
		// Queries scheduled here will run in parallel.
		//create table to hold all searches 
		db.run('CREATE TABLE IF NOT EXISTS `searchtable` (`date` TEXT, `query` TEXT)');
		//create table to hold all documents that have been uploaded
		db.run('CREATE TABLE IF NOT EXISTS `opened` (`path` TEXT PRIMARY KEY, `author` TEXT, `filetype` TEXT, `title` TEXT)')
		//author, filetype, filename, path
   });
   
	
		console.log("Table initialised");
});

	
function Database() {
    "use strict";

    this.db = 'colenso';
	this.session;// = new basex.Session("localhost", 1984, "admin", "admin");
	//this.session.execute('OPEN colenso');
	
	
	
	this.loadStructure = function(callback){
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		
		basex.debug_mode = false;
		
		// create query instance
		var input = 'for $item in collection("' + this.db + '") order by db:path($item) return db:path($item)'; 
		
		var query = this.session.query(input);
		// Build the node structure
		var rootNode = {children:{}};
		
		query.results( function (err, result) {
			assert.equal(err, null);
			//convert result to array of array
			var result_array = [];
			for (var i = 0; i < result.result.length; i++){
				
				result_array.push(result.result[i].split('/'));
			}
			convertToHierarchy(rootNode, result_array);
			callback(rootNode);
		});

		
		// close query instance
		query.close();

		// close session
		this.session.close();
	},
	
	this.getFileInfo = function(collection, callback){
		// create query instance
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		console.log(collection);
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'<result>{for $item in collection("' + this.db + '/' + collection + '")/TEI/teiHeader ' +
					'let $path := db:path($item) ' +
					'let $title := $item/fileDesc/titleStmt//title/text()' +
					'let $author := $item//titleStmt//author//text()' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>}</result>';
		
		var query = this.session.query(input);
		query.execute(function (err, result) {
			
			callback(result.result);
		});
		// close query instance
		query.close();

		// close session
		this.session.close();
	},
	
	this.getFile = function(collection, callback){
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		// create query instance
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'for $item in collection("' + this.db + '/' + collection + '") ' +
					'let $title := $item/TEI/teiHeader/fileDesc/titleStmt//title/text() ' +
					'let $path := db:path($item) ' +
					'return <result><path>{$path}</path><title>{$title}</title> {$item//front} {$item//body}</result>';
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);			
			callback(result.result);
		});
		
		// close query instance
		query.close();
		
		// close session
		this.session.close();
	},
	
	this.addQueryToDatabase = function(query){
		
		var stmt = db.prepare("INSERT INTO `searchtable` VALUES (?,?)");
		var date = new Date().toISOString();
		stmt.run(date, query);
		stmt.finalize();
		
		db.each("SELECT `date`, `query` FROM `searchtable`", function(err, row){
			//console.log(row);
			console.log("Date: " + row.date + ", Query: " + row.query);
		});
		
	},
	this.addOpenedFileToDatabase = function(path, author, filetype, title){
		
		var stmt = db.prepare("INSERT INTO `opened` VALUES (?, ?, ?, ?)");
		
		stmt.run(path, author, filetype, title);
		stmt.finalize();
		
		db.each("SELECT `path`, `author`, `filetype`, `title` FROM `opened`", function(err, row){
			//console.log(row);
			console.log("Path: " + row.path + ", Author: " + row.author + ", Filetype: " + row.filetype + ", Title: " + row.title );
		});
		
	},
	
	this.getFileRaw = function(collection, callback){
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		// create query instance
		
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'for $item in collection("' + this.db + '/' + collection + '") ' +
					'let $title := $item/TEI/teiHeader/fileDesc/titleStmt//title/text() ' +
					'let $path := db:path($item) ' +
					'return <result><path>{$path}</path><xml>{$item}</xml></result>';
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			console.log(result.result);
			callback(result.result);
		});
		// close query instance
		query.close();
		
		// close session
		this.session.close();
	},
	this.getFileRawToEdit = function(collection, callback){
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		// create query instance
		
		console.log(collection);
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'for $item in collection("' + this.db + '/' + collection + '") ' +
					'return $item';
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			//console.log(result.result);
			callback(result.result);
		});
		// close query instance
		query.close();
		
		// close session
		this.session.close();
	},
	this.getFileRawData = function(collection, callback){
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		// create query instance
		
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'for $item in collection("' + this.db + '/' + collection + '") ' +
					'let $title := $item/TEI/teiHeader/fileDesc/titleStmt//title/text() ' +
					'let $path := db:path($item) ' +
					'return <result><path>{$path}</path><xml>{$item}</xml></result>';
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			console.log(result.result);
			callback(result.result);
		});
		// close query instance
		query.close();
		
		// close session
		this.session.close();
		
	},
	this.textSearch = function(query, callback){
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		if (query){this.addQueryToDatabase(query);}
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";  for $doc in collection("colenso") where $doc//text() contains text '+parseQuery(query)+
					' let $path := db:path($doc) ' +
					'let $title := $doc/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := $doc/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';
		
		console.log(input);
		var query = this.session.query(input);
		query.execute(function (err, result) {
			if (!err == null){
				callback("");
			}
			//assert.equal(err, null);
			//console.log(result.result);
			result ? callback(result.result) : callback("");
		});			
		
		
		
		// close query instance
		query.close();


		// close session
		this.session.close();
	},
	
	this.markupSearch = function(query, callback){
		
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		if (query){this.addQueryToDatabase(query);}
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0"; for $item in '+ parseQuery(query) +
					' let $path := db:path(root($item)) ' +
					'let $title := root($item)/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := root($item)/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';

		console.log(input);
//		declare default element namespace "http://www.tei-c.org/ns/1.0";  for $item in /TEI let $xml := collection("colenso/" || db:path) let $path:=db:path($xml)  
		//declare default element namespace "http://www.tei-c.org/ns/1.0";  for $doc in collection("colenso") for $item in db:path($doc) return $item
		

		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			//console.log(result.result);
			callback(result.result);
		});			
		
		/*
		
		this.session.execute("XQUERY " + input, function(error, result){
			assert.equal(error, null);
			console.log(result);
			callback(result.result);			
		})
		
		
		declare default element namespace "http://www.tei-c.org/ns/1.0"; for $item in /TEI/text  
		let $path := db:path(root($item)) 
		let $title := root($item)/TEI/teiHeader/fileDesc//titleStmt//title/text()

		let $author := root($item)/TEI/teiHeader//titleStmt//author//text() 
		return <result><path>{$path}</path><title>{$title}</title><author>{$author}</author></result>
		*/			
		

					
		// close query instance
		query.close();

		// close session
		this.session.close();
	},
	
	this.addFile = function(path, target, callback){

		this.getFile(path, function(result){
			console.log(result);
			if(!result){
				var session = new basex.Session("localhost", 1984, "admin", "admin");
				session.execute('OPEN colenso');
				session.add(path, target, function(err, result){
					console.log(result);
					callback(result); //result.ok may be true or false
				});
				session.close();
			}
			else{
				callback("Error");
			}
			
		});
		// close session

		
		//return "Testing";
	},
	this.validateXML = function(xmlToValidate, callback){
		
		var session = new basex.Session("localhost", 1984, "admin", "admin");
		var validateXMLQuery = 'let $doc := ' + xmlToValidate +
							" let $schema := <xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema' targetNamespace='http://www.tei-c.org/ns/1.0'>     <xs:element name='TEI'/>   </xs:schema>" +
							' return validate:xsd($doc, $schema)';
							
		var query = session.query(validateXMLQuery);
		console.log(validateXMLQuery);
		query.execute(function (err, result) {
				callback(result);
				session.close();
			
		});		
		
		

/*
		var schemaPath ="resources/tei_bare.xsd"; 
		fs.readFile(schemaPath, 'utf-8', function(err, schema){
			if (err){
				console.log("error in readfile");
				console.log(err);
				callback(false);
			}
			var session = new basex.Session("localhost", 1984, "admin", "admin");
			var validateXMLQuery = 'let $doc := ' + xmlToValidate +
								" let $schema :="  + schema +
								' return validate:xsd($doc, $schema)';
								
			var query = session.query(validateXMLQuery);
			console.log(validateXMLQuery);
			query.execute(function (err, result) {
				if (result.ok){
					callback(true);
					session.close();
				}else{
					console.log(result);
					console.log(err);
					callback(false);
					session.close();
				}
			});
		});
		*/
	},
	this.updateFile = function(path, inputStream, callback){
		
		
		this.validateXML(inputStream, function(result){
			if (result.ok){
				var session = new basex.Session("localhost", 1984, "admin", "admin");
				session.execute('OPEN colenso');
				//check if inputStream is valid here
				
				//schema is valid
				var s = new Readable;
				s.push(inputStream);
				s.push(null);
				session.replace(path, s, function(err, result){
					console.log("-----\n");
					console.log(result);
					console.log(path);
					console.log("------");
					callback(result); //result.ok may be true or false
				});

				session.close();
				
			}else{
				callback(result);
			}
			
		});

		
	},
	this.readFile = function(path,encoding){
		fs.readFile(path, encoding, function(err, result){
			if (err) return err;
			callback(null, result);
		});
	}
	this.nestedSearch = function(searchhistory, callback){
		//searchhistory = [{searchtype : markup || text, searchstring : ""}]
		//first create search based on array of searches
		//then perform the query
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		var input = "collection('colenso')";
		for(var i = 0; i < searchhistory.length; i++){
			input = this.prepareNestedQuery(input, searchhistory[i]);
			//add last query to database since all the other ones have already been added
			if (i == searchhistory.length - 1){
				if(searchhistory[i].searchstring){this.addQueryToDatabase(searchhistory[i].searchstring);}
			}
		}
		
		var query = 'declare default element namespace "http://www.tei-c.org/ns/1.0"; for $item in ( '+ input + ' ) ' +
					' let $path := db:path(root($item)) ' +
					'let $title := root($item)/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := root($item)/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';
					
		console.log(query);
		var query = this.session.query(query);
		query.execute(function (err, result) {
			assert.equal(err, null);
			//console.log(result.result);
			callback(result.result);
		});			
	},
	this.getNestedQueryPaths = function(searchhistory, callback){
		
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		var input = "collection('colenso')";
		for(var i = 0; i < searchhistory.length; i++){
			input = this.prepareNestedQuery(input, searchhistory[i]);
		}
		
		var query = 'declare default element namespace "http://www.tei-c.org/ns/1.0"; for $item in ( '+ input + ' ) ' +
					' let $path := db:path(root($item)) ' +
					'return <link><path>{$path}</path></link>';
					
		console.log(query);
		var query = this.session.query(query);
		query.execute(function (err, result) {
			assert.equal(err, null);
			//console.log(result.result);
			callback(result.result);
		});		
	},
	this.prepareNestedQuery = function(nestedquery, query){
		
		if (query.searchtype == "text"){
			return 'for $doc in ( '+ nestedquery+' ) where $doc//text() contains text '+parseQuery(query.searchstring) + ' return $doc';
		}
		else if (query.searchtype == "markup"){
			return 'for $doc in ( '+ nestedquery+' ) where $doc '+ parseQuery(query.searchstring)+' return $doc'
		}
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
module.exports.Database = Database;
