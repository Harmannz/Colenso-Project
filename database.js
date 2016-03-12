
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
		var input = 'for $item in collection("' + this.db + '") return db:path($item)'; 
		
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
					'<result>{for $item in collection("' + this.db + '/' + collection + '")/TEI/teiHeader/fileDesc/titleStmt ' +
					'let $path := db:path($item) ' +
					'let $title := substring($item//title/text(), 0,200) ' +
					'return <link><path>{$path}</path><title>{$title}</title></link>}</result>';
		
		var query = this.session.query(input);
		query.execute(function (err, result) {
			assert.equal(err, null);			
			callback(result.result);
		});
	}
}


module.exports.Database = Database;
