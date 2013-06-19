// Data Directory: Node.js won't expand a tilda, so going with relative path.
// The directory will be in the home folder if node is invoked by the runServer shell script
var dataRootDir = "IMCCrowdServer-Data";

var querystring = require("querystring"),
    fs          = require("fs"),
	formidable  = require("formidable"),
	util		= require("util");

try {fs.mkdirSync(dataRootDir)}
catch(e){}
	
var sessionLogStream = fs.createWriteStream(dataRootDir + "/" + "sessionLogStream.txt", {flags: 'a', encoding: 'utf8', mode: 0666});
var logStream = fs.createWriteStream(dataRootDir + "/" + "logStream.txt", {flags: 'a', encoding: 'utf8', mode: 0666});

function generateUUID() {
	// Generate a lexographically ascending uniqueID
	var date = Date.now()
	date = date.toString();
	while (date.length < 13) date = "0" + date;

	var random = Math.round(Math.random() * 1E18);
	random = random.toString();
	while (random.length < 18) random = "0" + random;

	return (date + 'x' + random);
}

function validateUUID(UUID) {
	var success = true;
	success = success && (UUID.length == 32);
	success = success && (UUID.charAt(13) == "x");
	
	return success;
}

/* Client makes POST request to registerID on session start
 * Fields
 *   ID: <blank or previously supplied ID>
 *   Time: device time
 * Returns
 *   ID: a unique ID
 *
 * Crucially, maintains a log on server linking supplied IDs to new IDs.
 */

function clientv1RegisterID(response, request) {
	console.log("Request handler 'clientv1RegisterID' was called")
		
	var form = new formidable.IncomingForm();
    form.parse(request, function(error, fields, files) {
		
		// Parse out sessionID supplied in registration request
		var sentUUID = fields['sessionID'];
		console.log("sentUUID: " + sentUUID);

		// Parse out client timestamp in registration request
		var timeClient = fields['time'];

		// Generate a new sessionID for this session being registered
		var newUUID = generateUUID();
		console.log("newUUID: " + newUUID);
		
		// Log link betweensentUUID and newUUID
		if (validateUUID(sentUUID))
			sessionLogStream.write(sentUUID + " -> " + newUUID + " with client time: " + timeClient + "\n");
		else
			sessionLogStream.write("New Client: " + newUUID + " with client time: " + timeClient + "\n");
			
		// Respond back with new UUID
		response.writeHead(200, {'content-type': 'text/plain'});
		response.write(newUUID);
		response.end();
	});
}

/* Client makes POST request to upload a data file
 * Fields
 * Returns
 *
 */

function clientv1UploadData(response, request) {
  console.log("Request handler 'clientv1UploadData' was called.");
  
  var form = new formidable.IncomingForm();
  console.log("about to parse");
  form.parse(request, function(error, fields, files) {
    console.log("parsing done");
    response.writeHead(200, {'content-type': 'text/json'});

	var body;
	body  = 'received upload:\n\n';
	body += util.inspect({fields: fields, files: files});
	console.log(body);
		
	// Store the file
	
	var success = false;
	
	var uploadSessionID = fields['uploadSessionID'];
	var sessionID = fields['folder'];
	var folder = sessionID;
	
	// If the folder isn't what we expect (ie. 'No Session'), then change it something we expect
	if (!validateUUID(folder)) {
		logStream.write("Upload of file from folder " + folder + " to be filed into it's uploadSessionID: " + uploadSessionID + "\n");
		folder = uploadSessionID;
	}
	
	if (validateUUID(uploadSessionID)) {
		// TODO: ASYNC THIS!
		
		try 
		{
			fs.mkdirSync(dataRootDir + "/" + "uploadedFiles", 0750);
		}
		catch(e) {console.log("Directory already present - uploadedFiles");}
		try 
		{
			fs.mkdirSync(dataRootDir + "/" + "uploadedFiles" + "/" + folder, 0750);
		}
		catch(e) {console.log("Directory already present - uploadedFiles" + "/" + folder);}
		var newPath = dataRootDir + "/" + "uploadedFiles" + "/" + folder + "/" + files.file.name;
		
		try 
		{
			fs.renameSync(files.file.path, newPath);
			console.log("Uploaded file moved to " + newPath);
			success = true;
		}
		catch(e) {console.log("Failed to move uploaded file from " + files.file.path + " to " + newPath);}
	}
	
	// Return success (or not)
	
	var returnInfo = new Object();
	returnInfo['logSessionID'] = sessionID;
	returnInfo['fileName'] = files.file.name;
	returnInfo['success'] = success;
	
    response.write(JSON.stringify(returnInfo));
    response.end();

	if (success) 	logStream.write("Received file " + files.file.name + " from sessionID " + sessionID + "\n");
	else 		logStream.write("Failed to receive file " + files.file.name + " from sessionID " + sessionID + "\n");

	console.log("Sent response body " + JSON.stringify(returnInfo));
  });
}

exports.clientv1RegisterID = clientv1RegisterID;
exports.clientv1UploadData = clientv1UploadData;