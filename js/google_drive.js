function GoogleDrive(app) {
  this.app = app;

  this.clientId = '569657632946-i88sl1555v27jaji65nppshj7svopn2a.apps.googleusercontent.com';
  this.permissionScopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.appfolder',
      'https://www.googleapis.com/auth/drive.appdata',
      // Add other scopes needed by your application.
    ];
}

/**
* Check if the current user has authorized the application.
*/
GoogleDrive.prototype.checkAuth = function() {
  if (!gapi || !gapi.auth) {
    // if client library has not been loaded
    window.setTimeout(this.checkAuth.bind(this), 200);
    return;
  }
  gapi.auth.authorize(
      {'client_id': this.clientId, 'scope': this.permissionScopes.join(' '), 'immediate': true},
      this.handleAuthResult.bind(this));
};

/**
* Called when authorization server replies.
*
* @param {Object} authResult Authorization result.
*/
GoogleDrive.prototype.handleAuthResult = function(authResult) {
  var self = this;
  var authorizeButton = document.getElementById('blacklist_driveAuthorize');
  var loadButton = document.getElementById('blacklist_driveLoad');
  var saveButton = document.getElementById('blacklist_driveSave');
  if (authResult && !authResult.error) {
    // Access token has been successfully retrieved, requests can be sent to the API
    authorizeButton.style.display = 'none';
    loadButton.style.display = 'none';
    saveButton.style.display = 'none';
    // good to call api
    gapi.client.load('drive', 'v2', function() {
      // optionally shows the loading complete icon
      self.listFiles(function(results) {
        for (var r in results) {
          var result = results[r];
          if (!result) continue;
          if (result.downloadUrl && result.title == 'PttChrome blacklist') {
            self.app.pref.blacklistFileId = result.id;
            break;
          }
        }
        
        saveButton.style.display = '';
        if (self.app.pref.blacklistFileId) {
          // got the file already
          loadButton.style.display = '';
        } else {
          loadButton.style.display = 'none';
        }
      });
    });
  } else {
    // No access token could be retrieved, force the authorization flow.
    authorizeButton.style.display = '';
    loadButton.style.display = 'none';
    saveButton.style.display = 'none';
    authorizeButton.onclick = self.handleAuthClick.bind(self);
  }
};


/**
* update file in the Application Data folder. create new file if not exist
*
* @param {string} str String to store.
* @param {Function} callback Function to call when the request is complete.
*/
GoogleDrive.prototype.updateFile = function(str, fileId, method, callback) {
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  var contentType = 'application/octet-stream';
  var metadata = {
    'title': 'PttChrome blacklist',
    'mimeType': contentType
  };

  // convert from string to base64 encoded data.
  var base64Data = btoa(str);
  var multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + contentType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    close_delim;

  if (fileId) fileId = '/' + fileId;

  var request = gapi.client.request({
    'path': '/upload/drive/v2/files' + fileId,
    'method': method,
    'params': {'uploadType': 'multipart'},
    'headers': {
      'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    },
    'body': multipartRequestBody});
  if (!callback) {
    callback = function(file) {
      console.log(file)
    };
  }
  request.execute(callback);
};

/**
* Print a file's metadata.
*
* @param {String} fileId ID of the file to print metadata for.
*/
GoogleDrive.prototype.printFile = function(fileId) {
  var request = gapi.client.drive.files.get({
    'fileId': fileId
  });
  request.execute(function(resp) {
    console.log('Title: ' + resp.title);
    console.log('Description: ' + resp.description);
    console.log('MIME type: ' + resp.mimeType);
  });
};

GoogleDrive.prototype.retrievePageOfFiles = function(callback, request, result) {
  var self = this;
  request.execute(function(resp) {
    result = result.concat(resp.items);
    var nextPageToken = resp.nextPageToken;
    if (nextPageToken) {
      request = gapi.client.drive.files.list({
            'pageToken': nextPageToken
      });
      self.retrievePageOfFiles(callback, request, result);
    } else {
      callback(result);
    }
  });
};

GoogleDrive.prototype.listFiles = function(callback) {
  var initialRequest = gapi.client.drive.files.list();
  this.retrievePageOfFiles(callback, initialRequest, []);
};

GoogleDrive.prototype.listFilesInApplicationDataFolder = function(callback) {
  var initialRequest = gapi.client.drive.files.list({
    'q': '\'appfolder\' in parents'
  });
  this.retrievePageOfFiles(callback, initialRequest, []);
};

/**
* Download a file's content.
*
* @param {File} file Drive File instance.
* @param {Function} callback Function to call when the request is complete.
*/
GoogleDrive.prototype.downloadFile = function(file, callback) {
  if (file.downloadUrl) {
    var accessToken = gapi.auth.getToken().access_token;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', file.downloadUrl);
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onload = function() {
      callback(xhr.responseText);
    };
    xhr.onerror = function() {
      callback(null);
    };
    xhr.send();
  } else {
    callback(null);
  }
};

GoogleDrive.prototype.handleAuthClick = function(e) {
  gapi.auth.authorize(
      {'client_id': this.clientId, 'scope': this.permissionScopes, 'immediate': false}, 
      this.handleAuthResult.bind(this));
  return false;
}