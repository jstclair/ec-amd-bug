After cloning the repo, 

  * Ensure you have the right npm globals installed:

```
npm install -g gulp typescript bower http-server 
```
The last one is optional, but I'm going to assume it's installed later.

  * Install local and bower deps

```
npm install
bower install
```

  * Build the site using gulp

```
gulp
```

  * Start http-server for the src/ folder (will work because of our tremendous hack)

```
http-server src/
```

Open a browser to http://localhost:8080/

EditableCell is working! This, however, is due to the preEditableCell.js script (in the src/vendor folder) and a shim (in the src/app/require.config.js file).

  * Quit the previous http-server instance, and run it from the dist folder. 

```
http-server dist/
```

Opening a browser, you will see it *doesn't* work. 