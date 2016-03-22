
var basex  = require("basex"),
	convertToHierarchy = require("./data/navigation").convertToHierarchy,
	assert = require('assert'),
	log = require('./debug'),
	Readable = require('stream').Readable;


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
		
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'for $item in collection("' + this.db + '/' + collection + '") ' +
					'return $item';
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
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";  for $doc in collection("colenso") where $doc/TEI//body//text() contains text '+query+
					' let $path := db:path($doc) ' +
					'let $title := $doc/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := $doc/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';
		

		var query = this.session.query(input);
		query.execute(function (err, result) {
			if (!err == null){
				callback("");
			}
			assert.equal(err, null);
			//console.log(result.result);
			callback(result.result);
		});			
					
		// close query instance
		query.close();


		// close session
		this.session.close();
	},
	
	this.markupSearch = function(query, callback){

		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0"; for $item in '+ query +
					' let $path := db:path(root($item)) ' +
					'let $title := root($item)/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := root($item)/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';


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
	
	this.updateFile = function(path, inputStream, callback){
		var session = new basex.Session("localhost", 1984, "admin", "admin");
		session.execute('OPEN colenso');
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
		
	},
	
	this.nestedSearch = function(searchhistory, callback){
		//searchhistory = [{searchtype : markup || text, searchstring : ""}]
		//first create search based on array of searches
		//then perform the query
		this.session = new basex.Session("localhost", 1984, "admin", "admin");
		this.session.execute('OPEN colenso');
		var input = "collection('colenso')";
		for(var i = 0; i < searchhistory.length; i++){
			input = this.prepareNestedQuery(input, searchhistory[i]);
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
	
	this.prepareNestedQuery = function(nestedquery, query){
		if (query.searchtype == "text"){
			return 'for $doc in ( '+ nestedquery+' ) where $doc/TEI//body//text() contains text '+query.searchstring + ' return $doc';
		}
		else if (query.searchtype == "markup"){
			return 'for $doc in ( '+ nestedquery+' ) where $doc '+ query.searchstring+' return $doc'
		}
	}
}


module.exports.Database = Database;
