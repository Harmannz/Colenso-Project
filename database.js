
var basex  = require("basex"),
	convertToHierarchy = require("./data/navigation").convertToHierarchy,
	assert = require('assert');


function Database() {
    "use strict";

    this.db = 'colenso';
	this.session = new basex.Session("localhost", 1984, "admin", "admin");
	
	this.loadStructure = function(callback){
		
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

		/*
		// close query instance
		query.close();

		// close session
		session.close();
		*/
	},
	
	this.getFileInfo = function(collection, callback){
		// create query instance
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'<result>{for $item in collection("' + this.db + '/' + collection + '")/TEI/teiHeader ' +
					'let $path := db:path($item) ' +
					'let $title := $item/fileDesc/titleStmt//title/text()' +
					'let $author := $item//titleStmt//author//text()' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>}</result>';
		
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);			
			callback(result.result);
		});
	},
	
	this.getFile = function(collection, callback){
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
	},
	
	this.getFileRaw = function(collection, callback){
		// create query instance
		
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";' +
					'for $item in collection("' + this.db + '/' + collection + '") ' +
					'let $title := $item/TEI/teiHeader/fileDesc/titleStmt//title/text() ' +
					'let $path := db:path($item) ' +
					'return <result><path>{$path}</path>{$item}</result>';
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			console.log(result.result);
			callback(result.result);
		});
	}
	
	this.textSearch = function(query, callback){
		var input = 'declare default element namespace "http://www.tei-c.org/ns/1.0";  for $doc in collection("colenso") where $doc/TEI//body//text() contains text '+query+
					' let $path := db:path($doc) ' +
					'let $title := $doc/TEI/teiHeader/fileDesc//titleStmt//title/text() ' +
					'let $author := $doc/TEI/teiHeader//titleStmt//author//text() ' +
					'return <link><path>{$path}</path><title>{$title}</title><author>{$author}</author></link>';
		
		console.log(input);
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);
			console.log(result.result);
			callback(result.result);
		});			
					
	}
	
}


module.exports.Database = Database;
