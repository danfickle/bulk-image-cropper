function Stream(byteLength, littleEndian) {
    var instance = this;
    this._array = new ArrayBuffer(byteLength);
    this._view = new DataView(this._array, 0, byteLength);
    this._capacity = byteLength;
    this._length = 0;
    this._le = littleEndian;

    this._resize = function(extraCapacity) {
       if (instance._capacity >= instance._length + extraCapacity) {
           return;
       }

       var newCapacity = instance._capacity * 2;
       while (newCapacity < instance._length + extraCapacity) {
           newCapacity *= 2;
       }

       var newArray = new ArrayBuffer(newCapacity);
       var newView = new DataView(newArray, 0, newCapacity);
       for (var i = 0; i < instance._length; i++) {
           newView.setUint8(i, instance._view.getUint8(i));
       }
       instance._array = newArray;
       instance._view = newView;
       instance._capacity = newCapacity;
    };

    this.writeUint8 = function(byte) {
       instance._resize(1);
       instance._view.setUint8(instance._length, byte);
       instance._length++;
    };

    this.writeUint16 = function(uint16) {
       instance._resize(2);
       instance._view.setUint16(instance._length, uint16, instance._le);
       instance._length += 2;
    };

    this.writeUint32 = function(uint32) {
        instance._resize(4);
        instance._view.setUint32(instance._length, uint32, instance._le);
        instance._length += 4;
    };

    this.writeUint8Array = function(arr) {
        instance._resize(arr.length);
        for (var i = 0; i < arr.length; i++) {
            instance._view.setUint8(instance._length, arr[i], instance._le);
            instance._length++;
        }
    };

    this.finalize = function() {
        var newArray = new ArrayBuffer(instance._length);
        var newView = new DataView(newArray, 0, instance._length);

        for (var i = 0; i < instance._length; i++) {
            newView.setUint8(i, instance._view.getUint8(i));
        }

        return newArray;
    }

}

/**
 * The following functions come from pako, from pako/lib/zlib/crc32.js
 * released under the MIT license, see pako https://github.com/nodeca/pako/
 */
function makeTable() {
    var c, table = [];

    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
    }

    return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();

function crc32(crc, buf, len, pos) {
    var t = crcTable, end = pos + len;

    crc = crc ^ (-1);

    for (var i = pos; i < end; i++ ) {
        crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    }

    return (crc ^ (-1)); // >>> 0;
}
// That's all for the pako functions.


function calcCrc32(ab) {
   return crc32(0, new Uint8Array(ab, 0, ab.byteLength), ab.byteLength, 0);
}

// From:
// https://gist.github.com/joni/3760795
function toUTF8Array(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff))
            utf8.push(0xf0 | (charcode >>18), 
                      0x80 | ((charcode>>12) & 0x3f), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}




LOCAL_FILE_HEADER = "PK\x03\x04";
CENTRAL_FILE_HEADER = "PK\x01\x02";
CENTRAL_DIRECTORY_END = "PK\x05\x06";
ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
DATA_DESCRIPTOR = "PK\x07\x08";

function createZip(fileQueue) {
    var zip = new Stream(128000, true);
    var date = new Date();

    dosTime = date.getHours();
    dosTime = dosTime << 6;
    dosTime = dosTime | date.getMinutes();
    dosTime = dosTime << 5;
    dosTime = dosTime | date.getSeconds() / 2;

    dosDate = date.getFullYear() - 1980;
    dosDate = dosDate << 4;
    dosDate = dosDate | (date.getMonth() + 1);
    dosDate = dosDate << 5;
    dosDate = dosDate | date.getDate();

    for (var i = 0; i < fileQueue.length; i++) {
        fileQueue[i].offset = zip._length;

        // Local file signature constant.
        zip.writeUint8Array([0x50, 0x4b, 0x03, 0x04]);

        // Version made by.
        zip.writeUint16(0x0014);

        // General flags, 11th bit is UTF-8 encoding for filenames.
        zip.writeUint16(0x0800);

        // Compression method, 0 for STORE (no compression).
        zip.writeUint16(0x00);

        // DOS Modified time field.
        zip.writeUint16(dosTime);

        // DOS Modified date field.
        zip.writeUint16(dosDate);

        // CRC32 checksum.
        zip.writeUint32(fileQueue[i].crc);

        // Compressed size.
        zip.writeUint32(fileQueue[i].buffer.byteLength);

        // Uncompressed size.
        zip.writeUint32(fileQueue[i].buffer.byteLength);

        // Length of filename.
        var utf8 = toUTF8Array(fileQueue[i].fileName);
        zip.writeUint16(utf8.length);

        // Length of extra fields segment
        zip.writeUint16(0x00);

        // Filename in UTF-8.
        zip.writeUint8Array(utf8);

        // Now the file contents:
        var src = new Uint8Array(fileQueue[i].buffer, 0, fileQueue[i].buffer.byteLength);
        var srclen = fileQueue[i].buffer.byteLength;

        for (var j = 0; j < srclen; j++) {
            zip.writeUint8(src[j]);
        }
    }

    var centralDirectoryOffset = zip._length;

    // Now the central directory file headers.
    for (var k = 0; k < fileQueue.length; k++) {
        // Signature constant.
        zip.writeUint8Array([0x50, 0x4b, 0x01, 0x02]);

        // Version made by.
        zip.writeUint16(0x0014);

        // Version needed to extract
        zip.writeUint16(0x00A0);

        // General flags, 11th bit is UTF-8 encoding for filenames.
        zip.writeUint16(0x0800);

        // Compression method, 0 for STORE (no compression).
        zip.writeUint16(0x00);

        // DOS Modified time field.
        zip.writeUint16(dosTime);

        // DOS Modified date field.
        zip.writeUint16(dosDate);

        // CRC32 checksum.
        zip.writeUint32(fileQueue[k].crc);

        // Compressed size.
        zip.writeUint32(fileQueue[k].buffer.byteLength);

        // Uncompressed size.
        zip.writeUint32(fileQueue[k].buffer.byteLength);

        // Length of filename.
        var utf8 = toUTF8Array(fileQueue[k].fileName);
        zip.writeUint16(utf8.length);

        // Length of extra fields segment
        zip.writeUint16(0x00);

        // File comment length.
        zip.writeUint16(0x00);

        // Disk number.
        zip.writeUint16(0x00);

        // Internal attributes.
        zip.writeUint16(0x00);

        // External attributes for file such as hidden/directory, etc.
        zip.writeUint32(0x00);

        // Offset of local file header into zip file.
        zip.writeUint32(fileQueue[k].offset);

        // Filename in UTF-8.
        zip.writeUint8Array(utf8);
    }

    var endCentralDirectory = zip._length;

    // End of central directory.
    // Signature constant.
    zip.writeUint8Array([0x50, 0x4b, 0x05, 0x06]);

    // Disk number.
    zip.writeUint16(0x00);

    // Disk number with central directory.
    zip.writeUint16(0x00);

    // Number of central directory entries on this disk.
    zip.writeUint16(fileQueue.length);

    // Total central directory entries.
    zip.writeUint16(fileQueue.length);

    // Central directory size.
    zip.writeUint32(endCentralDirectory - centralDirectoryOffset);

    // Central directory offset
    zip.writeUint32(centralDirectoryOffset);

    // Comment length
    zip.writeUint16(0x00);

    var zipBuffer = zip.finalize();
    var transfer = fileQueue.map(function(itm) { return itm.blob });
    transfer.push(zipBuffer);

    postMessage({ zip: zipBuffer });
}

onmessage = function(e) {
    var fileQueue = e.data;

    if (fileQueue.length === 0) {
        return;
    }

    var idx = 0;

    var fr = new FileReader();

    fr.onload = function(e) {
       fileQueue[idx].buffer = e.target.result;
       fileQueue[idx].crc = calcCrc32(fileQueue[idx].buffer);
       idx++;
       if (idx >= fileQueue.length) {
          createZip(fileQueue);
       } else {
          fr.readAsArrayBuffer(fileQueue[idx].blob);
       }
    };

    fr.readAsArrayBuffer(fileQueue[0].blob);
}