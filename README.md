## Try it online!
Coming very soon.

## What is this?
This is an in-browser HTML5 mass image cropping tool.
The user loads a list of image and provides a desired size or aspect ratio.
They are then shown the images one by one with a cropping mask which may be changed.
When they are finished customizing the cropping masks they create and download a zip with the cropped and optionally resized images.

## Deployment
+ Copy both `image-cropping-tool.html` and `zip-web-worker.js` to a web server. Due to browser security limits it will not run as a local file.
+ Optionally, open `image-cropping-tool.html` in a text editor and search for `TODO` to make any changes you require. For example, you could add some sample images.

## License
MIT license, although I would appreciate a link back to this repository:

https://github.com/danfickle/bulk-image-cropper

## Dependencies
+ The main work of customizing the cropping masks and cropping/resizing images is done by the excellent [cropper.js](https://github.com/fengyuanchen/cropperjs).
+ The UI is styled with [UI-kit](https://getuikit.com/).
+ UI functionality is provided by [Vue.js version 2](https://vuejs.org/).
+ Additionally jQuery is used.
