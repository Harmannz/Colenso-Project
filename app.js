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
	log = require("./debug")
	convertToHierarchy = require("./data/navigation").convertToHierarchy;


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

    // Homepage
    router.get("/", function(req, res) {
        "use strict";
        
		res.render('index', {isHomePage: true});
    });
    
    // Explore
    router.get("/explore", function(req, res) {
        "use strict";
		var author = req.query.author;
		var filetype = req.query.ftype;
		var collection="";
		
		if (author){
			if (filetype) {
				collection = ".children." + author + ".children." + filetype;		
			}else{
				collection = ".children." + author;			
			}	
		}
		console.log(collection);
		// create session
		var session = new basex.Session("localhost", 1984, "admin", "admin");
		basex.debug_mode = false;
		
		// create query instance
		var input = 'for $item in collection("colenso") return db:path($item)'; 
		
		var query = session.query(input);
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
			console.log(author);
			console.log(author ? rootNode.children[author] : rootNode.children);
			res.render('explore', {isHomePage: false,
								categories : author ? rootNode.children[author].children : rootNode.children});
		});

		// close query instance
		query.close();

		// close session
		session.close();
		
		//if 
		//var category = {name: "All", count : 10}
	 	//var categories = [{name: "All", count : 4},{name: "Colenso", count : 1}];
		
    });
    
    
    // Use the router routes in our application
    app.use('/', router);

    // Start the server listening
    var server = app.listen(3000, function() {
        var port = server.address().port;
        console.log('Colenso Project listening on port %s.', port);
    });
