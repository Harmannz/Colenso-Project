
var basex  = require("basex"),
	convertToHierarchy = require("./data/navigation").convertToHierarchy,
	assert = require('assert'),
	log = require('./debug'),
	Readable = require('stream').Readable,
	fs = require('fs'),
	sqlite3 = require("sqlite3").verbose();
	//tmp = require('tmp');
	
//Setup sqlite database
var dbFile = './test.db';
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
		//create table to hold all documents that have been opened
		db.run('CREATE TABLE IF NOT EXISTS `opened` (`path` TEXT , `author` TEXT, `filetype` TEXT, `title` TEXT)')
		//author, filetype, filename, path
		db.run('CREATE TABLE IF NOT EXISTS `upload-count` ( `id` INTEGER PRIMARY KEY, `count` INTEGER)');
   });
   
	console.log("Tables initialised");
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
	this.getStatistics = function(callback){
		var self = this;
		self.get100CommonQueriedDocuments(function(result){
			var mostQueried = result;
			self.get100CommonOpenedDocuments(function(result){
				var mostOpened = result;
				self.getTotalDocumentsViewed(function(result){
					var totalDocumentsViewed = result;
					self.getTotalDocumentsUploaded(function(result){
						var totalDocumentsUploaded = result;
						callback({
							mostQueried : mostQueried, 
							mostOpened : mostOpened, 
							totalDocumentsViewed : totalDocumentsViewed, 
							totalDocumentsUploaded : totalDocumentsUploaded
						});
					});
				});	
			});
				
				
				
		});
	/*	
				self.get100CommonQueriedDocuments(function(result){
					mostQueried = result;
					done1 = true;

				});
			//	deasync.loopWhile(function(){return !done;});
				
				//done = false;
				self.get100CommonOpenedDocuments(function(result){
					mostOpened = result;
					done2 = true;
					console.log("mO: "  + mostOpened);
					//done = true;						
				});
		//		deasync.loopWhile(function(){return !done;});

			//	done = false;
				self.getTotalDocumentsViewed(function(result){
					totalDocumentsViewed = result;
					done3 = true;

				//	done = true;						
				});
		//		deasync.loopWhile(function(){return !done;});

			//	done = false;
				self.getTotalDocumentsUploaded(function(result){
					totalDocumentsUploaded = result;
					done3 = true;
		//			done = true;						
				});
			
		*/
//		deasync.loopWhile(function(){ console.log("looping");return !mostQueried && !mostOpened && !totalDocumentsViewed && !totalDocumentsUploaded;});

		
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
	this.get100CommonQueriedDocuments = function(callback){
		var queries = [];
		db.each("SELECT `query`, COUNT(`query`) AS `occurrence` FROM `searchtable` GROUP BY `query` ORDER BY `occurrence` DESC LIMIT 100", function(err, row){
			if(err){console.log(err);}
			else{
				queries.push({query: row.query, occurrence: row.occurrence});
			}
		}, function(err, rowsReturned){
			if(err){console.log(err);}
			else{
				 callback(queries);
			}
		});
	},
	this.getAllQueriesInText = function(callback){
		var queries = "";
		db.each("SELECT `date`, `query` FROM `searchtable`", function(err, row){
			if(err){
				console.log(err);
			}else{
				if(row){
					queries = queries.concat(JSON.stringify({date : row.date, query : row.query}) + "\r\n");
				}
			}
		}, function(err, rowsReturned){
			if (err){console.log(err);}
			else{
				queries = JSON.stringify({rowsReturned : rowsReturned}).concat("\r\n" + queries);
				callback(queries);
			}
		});
	},
	this.get100CommonOpenedDocuments = function(callback){
		var openedDocs = [];
		
		db.each("SELECT `path`, COUNT(`path`) AS `occurrence`, `author`, `filetype`, `title` FROM `opened` GROUP BY `path` ORDER BY `occurrence` DESC LIMIT 100", function(err, row){
			if(err){console.log(err);}
			else{
				openedDocs.push({path : row.path, occurrence : row.occurrence, author : row.author, filetype : row.filetype, title : row.title});
			}
		}, function(err, rowsReturned){
			if(err){console.log(err);}
			else{
				console.log("returning: " + openedDocs);
				 callback(openedDocs);
			}
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
	this.incrementUploadCountInDatabase = function(){
		//first query db to get upload count value
		var ROWID = 1;
		//return count : oldCount + 1
		db.get("SELECT `id`, `count` FROM `upload-count`", function(err, row){
		    if (err) { console.log("Error adding to upload count: " + err);}
		    else {
				if(row){
					var id = row.id ? ROWID : 1;
					var count = row.count ? row.count + 1 : 1;
					db.run("UPDATE `upload-count` SET `count` = $count WHERE `id` = $id", {
						$id: row.id,
						$count: count
					});
				}else{
					//insert data 
					db.run("INSERT INTO `upload-count` VALUES (1, 1)");
				}
			}
		});
	},
	this.getTotalDocumentsUploaded = function(callback){
		db.get("SELECT `id`, `count` FROM `upload-count`", function(err, row){
			if (err) { console.log("Error getting upload count");}
			else{
				//console.log(row);
				callback(row && row.count ? row.count : 0);
			}
		});
	},
	this.getTotalDocumentsViewed = function(callback){
		db.get("SELECT COUNT(*) as `count` FROM `opened`", function(err, row){
			if (err) {console.log("Error in retrieving total documents viewed: " + err)}
			else {
				//console.log(row);
				callback(row && row.count ? row.count :  0);
			}
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
					
		console.log(input);
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			callback(result.result);
		});
		
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
		var self = this;
		var originalQuery = query;
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
//		if (query){this.addQueryToDatabase(query);}
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";  for $doc in collection("colenso") where $doc//text() contains text '+parseQuery(query)+
					' let $path := db:path($doc) ' +
					'let $title := $doc/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := $doc/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';
		
		console.log(input);
		var query = this.session.query(input);
		query.execute(function (err, result) {
			
			if (err){
				callback({ok: false});
			}else{
			//assert.equal(err, null);
			//console.log(result.result);
			
				originalQuery ? self.addQueryToDatabase(originalQuery) : ""; 
				callback(result)
			}
		});			
		
		
		
		// close query instance
		query.close();


		// close session
		this.session.close();
	},
	
	this.markupSearch = function(query, callback){
		var self = this;
		var originalQuery = query;
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		//if (query){this.addQueryToDatabase(query);}
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
			
			if (err){
				callback({ok: false});
			}else{
				originalQuery ? self.addQueryToDatabase(originalQuery) : ""; 
				callback(result)
			}
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
							" let $schema := 'http://www.tei-c.org/release/xml/tei/custom/schema/xsd/tei_all.xsd'" +
							' return validate:xsd($doc, $schema)';
							
		var query = session.query(validateXMLQuery);
		console.log(validateXMLQuery);
		query.execute(function (err, result) {
				callback(result);
				session.close();
			
		});		
		
			/*
		
		var tmpobj = tmp.fileSync();
		console.log("File: ", tmpobj.name);
		console.log("Filedescriptor: ", tmpobj.fd);
		
		var session = new basex.Session("localhost", 1984, "admin", "admin");
		var validateXMLQuery = "XQUERY validate:xsd('" + tmpobj.name+ "', 'http://www.tei-c.org/release/xml/tei/custom/schema/xsd/tei_all.xsd')";
		//var query = session.query(validateXMLQuery);	
		// If we don't need the file anymore we could manually call the removeCallback 
		// But that is not necessary if we didn't pass the keep option because the library 
		// will clean after itself. 
		console.log(validateXMLQuery);
		session.execute("XQUERY validate:xsd('" + tmpobj.name+ "', 'http://www.tei-c.org/release/xml/tei/custom/schema/xsd/tei_all.xsd')", function (err, result) {				
				console.log(err);
				console.log(result);
				callback(result);
				session.close();
				tmpobj.removeCallback();
				
			});
		
		tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
			  if (err) throw err;
			  var session = new basex.Session("localhost", 1984, "admin", "admin");
			  console.log("File: ", path);
			  console.log("Filedescriptor: ", fd);
			  var validateXMLQuery = "XQUERY validate:xsd('" + path+ "', 'http://www.tei-c.org/release/xml/tei/custom/schema/xsd/tei_all.xsd')";
			  var query = session.query(validateXMLQuery);
			console.log('VALIDATING XML QUERY \n****************************'  + validateXMLQuery);
			query.execute(function (err, result) {				
				console.log(err);
				console.log(result);
				callback(result);
				session.close();
				
			});
			  // If we don't need the file anymore we could manually call the cleanupCallback 
			  // But that is not necessary if we didn't pass the keep option because the library 
			  // will clean after itself. 
			  console.log("closing file");
		});


		var schemaPath ="resources/tei_bare.xsd"; 
		fs.readFile(schemaPath, 'utf-8', function(err, schema){
			if (err){
				console.log("error in readfile");
				console.log(err);
				callback({ok:false});
			}
			var session = new basex.Session("localhost", 1984, "admin", "admin");
			var validateXMLQuery = 'let $doc := ' + xmlToValidate +
								" let $schema := '"  + schema +
								"' return validate:xsd($doc, $schema)";
								
			var query = session.query(validateXMLQuery);
			console.log('VALIDATING XML QUERY \n****************************'  + validateXMLQuery);
			query.execute(function (err, result) {				
				callback(result);
				session.close();
			});
			});
			
		});
		var schemaPath ="resources/tei_all.xsd";
		xsd.parseFile(schemaPath, function(err, schema){
			schema.validate(xmlToValidate, function(err, validationErrors){
				if (err){console.log(err);}
				else {
					console.log(validationErrors);
					if(!validationErrors){
						callback({ok:true});					
					}else{
					callback({ok:false});
					}
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
					'order by $item ' +
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
					operator.toLowerCase() == "&&" ? operators[i] = "ftand" : '';
					operator.toLowerCase() == "or" ? operators[i] = "ftor" : '';
					operator.toLowerCase() == "||" ? operators[i] = "ftor" : '';
					operator.toLowerCase() == "not" ? operators[i] = "ftnot" : '';
					operator.toLowerCase() == "!" ? operators[i] = "ftnot" : '';
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
