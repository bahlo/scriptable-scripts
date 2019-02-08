# scriptable-scripts

Scripts to use in the iOS app [Scriptable](https://scriptable.app).

:warning: Most of these are written to work for me. They are not considered "production ready". If you run into problems or have feature requests, feel free to create an issue.

## TaskPaperToThings

This script takes the clipboard expecting text in [TaskPaper](https://taskpaper.com) format, converts it to the [Things JSON format](https://support.culturedcode.com/customer/en/portal/articles/2803573) and copies the JSON back to the clipboard. 
It's designed to be used in the [Shortcuts.app](https://itunes.apple.com/us/app/shortcuts/id915249334).  
You can run it outside Scriptable with `node TaskPaperToThings.js` – it will not use the Clipboard and instead test the functionality.
