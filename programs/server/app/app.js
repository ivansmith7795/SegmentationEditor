var require = meteorInstall({
  "lib": {
    "collections.js": function module(require, exports, module) {

      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //                                                                                                                 //
      // lib/collections.js                                                                                              //
      //                                                                                                                 //
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //
      let Meteor;
      module.link("meteor/meteor", {
        Meteor(v) {
          Meteor = v;
        }

      }, 0);
      SseSamples = new Mongo.Collection("SseSamples");
      SseProps = new Mongo.Collection("SseProps");

      if (Meteor.isServer) {
        Meteor.publish("sse-data-descriptor", function (imageUrl) {
          return SseSamples.find({
            url: imageUrl
          });
        });
        Meteor.publish("sse-labeled-images", function () {
          return SseSamples.find({
            $where: 'this.objects && this.objects.length>0'
          }, {
            fields: {
              file: 1,
              url: 1
            }
          });
        });
        Meteor.publish('sse-props', function () {
          return SseProps.find({});
        });
      }
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    }
  }, "imports": {
    "editor": {
      "3d": {
        "SsePCDLoader.js": function module(require, exports, module) {

          /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
          //                                                                                                                 //
          // imports/editor/3d/SsePCDLoader.js                                                                               //
          //                                                                                                                 //
          /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
          //
          module.export({
            default: () => SsePCDLoader
          });

          class SsePCDLoader {
            constructor(THREE) {
              THREE.PCDLoader = function (serverMode) {
                this.serverMode = serverMode;
              };

              THREE.PCDLoader.prototype = {
                constructor: THREE.PCDLoader,
                load: function (url, onLoad, onProgress, onError) {
                  var scope = this;
                  var loader = new THREE.FileLoader(scope.manager);
                  loader.setResponseType('arraybuffer');
                  loader.load(url, function (data) {
                    onLoad(scope.parse(data, url));
                  }, onProgress, onError);
                },
                parse: function (data, url) {
                  function decompressLZF(inData, outLength) {
                    // from https://gitlab.com/taketwo/three-pcd-loader/blob/master/decompress-lzf.js
                    var inLength = inData.length;
                    var outData = new Uint8Array(outLength);
                    var inPtr = 0;
                    var outPtr = 0;
                    var ctrl;
                    var len;
                    var ref;

                    do {
                      ctrl = inData[inPtr++];

                      if (ctrl < 1 << 5) {
                        ctrl++;
                        if (outPtr + ctrl > outLength) throw new Error('Output buffer is not large enough');
                        if (inPtr + ctrl > inLength) throw new Error('Invalid compressed data');

                        do {
                          outData[outPtr++] = inData[inPtr++];
                        } while (--ctrl);
                      } else {
                        len = ctrl >> 5;
                        ref = outPtr - ((ctrl & 0x1f) << 8) - 1;
                        if (inPtr >= inLength) throw new Error('Invalid compressed data');

                        if (len === 7) {
                          len += inData[inPtr++];
                          if (inPtr >= inLength) throw new Error('Invalid compressed data');
                        }

                        ref -= inData[inPtr++];
                        if (outPtr + len + 2 > outLength) throw new Error('Output buffer is not large enough');
                        if (ref < 0) throw new Error('Invalid compressed data');
                        if (ref >= outPtr) throw new Error('Invalid compressed data');

                        do {
                          outData[outPtr++] = outData[ref++];
                        } while (--len + 2);
                      }
                    } while (inPtr < inLength);

                    return outData;
                  }

                  function parseHeader(data) {
                    var PCDheader = {};
                    var result1 = data.search(/[\r\n]DATA\s(\S*)\s/i);
                    var result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data.substr(result1 - 1));
                    PCDheader.data = result2[1];
                    PCDheader.headerLen = result2[0].length + result1;
                    PCDheader.str = data.substr(0, PCDheader.headerLen); // remove comments

                    PCDheader.str = PCDheader.str.replace(/\#.*/gi, ''); // parse

                    PCDheader.version = /VERSION (.*)/i.exec(PCDheader.str);
                    PCDheader.fields = /FIELDS (.*)/i.exec(PCDheader.str);
                    PCDheader.size = /SIZE (.*)/i.exec(PCDheader.str);
                    PCDheader.type = /TYPE (.*)/i.exec(PCDheader.str);
                    PCDheader.count = /COUNT (.*)/i.exec(PCDheader.str);
                    PCDheader.width = /WIDTH (.*)/i.exec(PCDheader.str);
                    PCDheader.height = /HEIGHT (.*)/i.exec(PCDheader.str);
                    PCDheader.viewpoint = /VIEWPOINT (.*)/i.exec(PCDheader.str);
                    PCDheader.points = /POINTS (.*)/i.exec(PCDheader.str); // evaluate

                    if (PCDheader.version !== null) PCDheader.version = parseFloat(PCDheader.version[1]);
                    if (PCDheader.fields !== null) PCDheader.fields = PCDheader.fields[1].split(' ');
                    if (PCDheader.type !== null) PCDheader.type = PCDheader.type[1].split(' ');
                    if (PCDheader.width !== null) PCDheader.width = parseInt(PCDheader.width[1]);
                    if (PCDheader.height !== null) PCDheader.height = parseInt(PCDheader.height[1]);
                    if (PCDheader.viewpoint !== null) PCDheader.viewpoint = PCDheader.viewpoint[1];
                    if (PCDheader.points !== null) PCDheader.points = parseInt(PCDheader.points[1], 10);
                    if (PCDheader.points === null) PCDheader.points = PCDheader.width * PCDheader.height;

                    if (PCDheader.size !== null) {
                      PCDheader.size = PCDheader.size[1].split(' ').map(function (x) {
                        return parseInt(x, 10);
                      });
                    }

                    const split = PCDheader.viewpoint.split(" ");
                    PCDheader.viewpoint = {
                      tx: split[0],
                      ty: split[1],
                      tz: split[2],
                      qw: split[3],
                      qx: split[4],
                      qy: split[5],
                      qz: split[6]
                    };

                    if (PCDheader.count !== null) {
                      PCDheader.count = PCDheader.count[1].split(' ').map(function (x) {
                        return parseInt(x, 10);
                      });
                    } else {
                      PCDheader.count = [];

                      for (let i = 0, l = PCDheader.fields.length; i < l; i++) {
                        PCDheader.count.push(1);
                      }
                    }

                    PCDheader.offset = {};
                    var sizeSum = 0;

                    for (let i = 0, l = PCDheader.fields.length; i < l; i++) {
                      if (PCDheader.data === 'ascii') {
                        PCDheader.offset[PCDheader.fields[i]] = i;
                      } else {
                        PCDheader.offset[PCDheader.fields[i]] = sizeSum;
                        sizeSum += PCDheader.size[i];
                      }
                    }

                    PCDheader.rowSize = sizeSum;
                    return PCDheader;
                  }

                  var textData = this.serverMode ? Buffer.from(data).toString() : THREE.LoaderUtils.decodeText(data); // parse header (always ascii format)

                  var PCDheader = parseHeader(textData); // parse data

                  var position = [];
                  var color = [];
                  var label = [];
                  var payload = [];
                  var rgb = [];

                  if (PCDheader.data === 'ascii') {
                    const meta = PCDheader;
                    let camPosition = new THREE.Vector3(parseFloat(meta.viewpoint.tx), parseFloat(meta.viewpoint.ty), parseFloat(meta.viewpoint.tz));
                    let camQuaternion = new THREE.Quaternion(meta.viewpoint.qx, meta.viewpoint.qy, meta.viewpoint.qz, meta.viewpoint.qw);
                    var offset = PCDheader.offset;
                    var pcdData = textData.substr(PCDheader.headerLen);
                    var lines = pcdData.split('\n');
                    let pt, item;

                    for (var i = 0, l = lines.length - 1; i < l; i++) {
                      if (lines[i] == "") {
                        continue;
                      } // Sometimes empty lines are inserted...


                      var line = lines[i].split(' ');
                      item = {};
                      payload.push(item);
                      pt = new THREE.Vector3(parseFloat(line[offset.x]), parseFloat(line[offset.y]), parseFloat(line[offset.z]));

                      if (!this.serverMode) {
                        pt = pt.sub(camPosition);
                        pt.applyQuaternion(camQuaternion);
                      }

                      item.x = pt.x;
                      position.push(pt.x);
                      item.y = pt.y;
                      position.push(pt.y);
                      item.z = pt.z;
                      position.push(pt.z);

                      if (offset.label !== undefined) {
                        const classIndex = parseInt(line[offset.label]) || 0;
                        item.classIndex = classIndex;
                        label.push(classIndex);
                      } else {
                        item.classIndex = 0;
                        label.push(0);
                      } // Initialize colors


                      if (offset.rgb != undefined) {
                        var colorRGB = parseInt(line[offset.rgb]);
                        var r = colorRGB >> 16 & 0x0000ff;
                        var g = colorRGB >> 8 & 0x0000ff;
                        var b = colorRGB & 0x0000ff;
                        rgb.push([r, g, b]);
                      }

                      color.push(0);
                      color.push(0);
                      color.push(0);
                    }
                  } // binary-compressed
                  // normally data in PCD files are organized as array of structures: XYZRGBXYZRGB
                  // binary compressed PCD files organize their data as structure of arrays: XXYYZZRGBRGB
                  // that requires a totally different parsing approach compared to non-compressed data


                  if (PCDheader.data === 'binary_compressed') {
                    var dataview = new DataView(data.slice(PCDheader.headerLen, PCDheader.headerLen + 8));
                    var compressedSize = dataview.getUint32(0, true);
                    var decompressedSize = dataview.getUint32(4, true);
                    var decompressed = decompressLZF(new Uint8Array(data, PCDheader.headerLen + 8, compressedSize), decompressedSize);
                    dataview = new DataView(decompressed.buffer);
                    var offset = PCDheader.offset;
                    let pt, item;
                    let camPosition = new THREE.Vector3(parseFloat(PCDheader.viewpoint.tx), parseFloat(PCDheader.viewpoint.ty), parseFloat(PCDheader.viewpoint.tz));
                    let camQuaternion = new THREE.Quaternion(PCDheader.viewpoint.qx, PCDheader.viewpoint.qy, PCDheader.viewpoint.qz, PCDheader.viewpoint.qw);

                    for (var i = 0; i < PCDheader.points; i++) {
                      item = {};
                      payload.push(item);
                      const x = dataview.getFloat32(PCDheader.points * offset.x + PCDheader.size[0] * i, true);
                      const y = dataview.getFloat32(PCDheader.points * offset.y + PCDheader.size[1] * i, true);
                      const z = dataview.getFloat32(PCDheader.points * offset.z + PCDheader.size[2] * i, true);
                      pt = new THREE.Vector3(x, y, z);

                      if (!this.serverMode) {
                        pt = pt.sub(camPosition);
                        pt.applyQuaternion(camQuaternion);
                      }

                      item.x = pt.x;
                      position.push(pt.x);
                      item.y = pt.y;
                      position.push(pt.y);
                      item.z = pt.z;
                      position.push(pt.z);

                      if (offset.label !== undefined) {
                        const classIndex = dataview.getUint8(PCDheader.points * offset.label + PCDheader.size[3] * i);
                        item.classIndex = classIndex;
                        label.push(classIndex);
                      } else {
                        item.classIndex = 0;
                        label.push(0);
                      } // Initialize colors


                      if (offset.rgb != undefined) {
                        var colorRGB = dataview.getUint32(row + offset.rgb, true);
                        var r = colorRGB >> 16 & 0x0000ff;
                        var g = colorRGB >> 8 & 0x0000ff;
                        var b = colorRGB & 0x0000ff;
                        rgb.push([r, g, b]);
                      }

                      color.push(0);
                      color.push(0);
                      color.push(0);
                    }
                  } // binary


                  if (PCDheader.data === 'binary') {
                    var dataview = new DataView(data, PCDheader.headerLen);
                    var offset = PCDheader.offset;
                    let pt, item; // test.push(offset);

                    let camPosition = new THREE.Vector3(parseFloat(PCDheader.viewpoint.tx), parseFloat(PCDheader.viewpoint.ty), parseFloat(PCDheader.viewpoint.tz));
                    let camQuaternion = new THREE.Quaternion(PCDheader.viewpoint.qx, PCDheader.viewpoint.qy, PCDheader.viewpoint.qz, PCDheader.viewpoint.qw);

                    for (var i = 0, row = 0; i < PCDheader.points; i++, row += PCDheader.rowSize) {
                      item = {};
                      payload.push(item);
                      const x = dataview.getFloat32(row + offset.x, true);
                      const y = dataview.getFloat32(row + offset.y, true);
                      const z = dataview.getFloat32(row + offset.z, true);
                      pt = new THREE.Vector3(x, y, z);

                      if (!this.serverMode) {
                        pt = pt.sub(camPosition);
                        pt.applyQuaternion(camQuaternion);
                      }

                      item.x = pt.x;
                      position.push(pt.x);
                      item.y = pt.y;
                      position.push(pt.y);
                      item.z = pt.z;
                      position.push(pt.z);

                      if (offset.label !== undefined) {
                        const classIndex = dataview.getUint8(row + offset.label);
                        item.classIndex = classIndex;
                        label.push(classIndex);
                      } else {
                        item.classIndex = 0;
                        label.push(0);
                      } // Initialize colors


                      if (offset.rgb != undefined) {
                        var colorRGB = dataview.getUint32(row + offset.rgb, true);
                        var r = colorRGB >> 16 & 0x0000ff;
                        var g = colorRGB >> 8 & 0x0000ff;
                        var b = colorRGB & 0x0000ff;
                        rgb.push([r, g, b]);
                      }

                      color.push(0);
                      color.push(0);
                      color.push(0);
                    }
                  } // build geometry


                  var geometry = new THREE.BufferGeometry();
                  if (position.length > 0) geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
                  if (label.length > 0) geometry.setAttribute('label', new THREE.Uint8BufferAttribute(label, 3));

                  if (color.length > 0) {
                    const colorAtt = new THREE.Float32BufferAttribute(color, 3);
                    geometry.setAttribute('color', colorAtt);
                  }

                  geometry.computeBoundingSphere();
                  var material = new THREE.PointsMaterial({
                    size: 2,
                    color: 0xE9A96F
                  });
                  material.sizeAttenuation = false; // build mesh

                  var mesh = new THREE.Points(geometry, material);
                  var name = url.split('').reverse().join('');
                  name = /([^\/]*)/.exec(name);
                  name = name[1].split('').reverse().join('');
                  mesh.name = url;
                  return {
                    position,
                    label,
                    header: PCDheader,
                    rgb
                  };
                }
              };
            }

          }
          /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        }
      }
    }
  }, "server": {
    "SseDataWorkerServer.js": function module(require, exports, module) {

      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //                                                                                                                 //
      // server/SseDataWorkerServer.js                                                                                   //
      //                                                                                                                 //
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //
      function FastIntegerCompression() { }

      function bytelog(val) {
        if (val < 1 << 7) {
          return 1;
        } else if (val < 1 << 14) {
          return 2;
        } else if (val < 1 << 21) {
          return 3;
        } else if (val < 1 << 28) {
          return 4;
        }

        return 5;
      } // compute how many bytes an array of integers would use once compressed


      FastIntegerCompression.computeCompressedSizeInBytes = function (input) {
        var c = input.length;
        var answer = 0;

        for (var i = 0; i < c; i++) {
          answer += bytelog(input[i]);
        }

        return answer;
      }; // compress an array of integers, return a compressed buffer (as an ArrayBuffer)


      FastIntegerCompression.compress = function (input) {
        var c = input.length;
        var buf = new ArrayBuffer(FastIntegerCompression.computeCompressedSizeInBytes(input));
        var view = new Int8Array(buf);
        var pos = 0;

        for (var i = 0; i < c; i++) {
          var val = input[i];

          if (val < 1 << 7) {
            view[pos++] = val;
          } else if (val < 1 << 14) {
            view[pos++] = val & 0x7F | 0x80;
            view[pos++] = val >>> 7;
          } else if (val < 1 << 21) {
            view[pos++] = val & 0x7F | 0x80;
            view[pos++] = val >>> 7 & 0x7F | 0x80;
            view[pos++] = val >>> 14;
          } else if (val < 1 << 28) {
            view[pos++] = val & 0x7F | 0x80;
            view[pos++] = val >>> 7 & 0x7F | 0x80;
            view[pos++] = val >>> 14 & 0x7F | 0x80;
            view[pos++] = val >>> 21;
          } else {
            view[pos++] = val & 0x7F | 0x80;
            view[pos++] = val >>> 7 & 0x7F | 0x80;
            view[pos++] = val >>> 14 & 0x7F | 0x80;
            view[pos++] = val >>> 21 & 0x7F | 0x80;
            view[pos++] = val >>> 28;
          }
        }

        return buf;
      }; // from a compressed array of integers stored ArrayBuffer, compute the number of compressed integers by scanning the input


      FastIntegerCompression.computeHowManyIntegers = function (input) {
        var view = new Int8Array(input);
        var c = view.length;
        var count = 0;

        for (var i = 0; i < c; i++) {
          count += input[i] >>> 7;
        }

        return c - count;
      }; // uncompress an array of integer from an ArrayBuffer, return the array


      FastIntegerCompression.uncompress = function (input) {
        var array = [];
        var inbyte = new Int8Array(input);
        var end = inbyte.length;
        var pos = 0;

        while (end > pos) {
          var c = inbyte[pos++];
          var v = c & 0x7F;

          if (c >= 0) {
            array.push(v);
            continue;
          }

          c = inbyte[pos++];
          v |= (c & 0x7F) << 7;

          if (c >= 0) {
            array.push(v);
            continue;
          }

          c = inbyte[pos++];
          v |= (c & 0x7F) << 14;

          if (c >= 0) {
            array.push(v);
            continue;
          }

          c = inbyte[pos++];
          v |= (c & 0x7F) << 21;

          if (c >= 0) {
            array.push(v);
            continue;
          }

          c = inbyte[pos++];
          v |= c << 28;
          array.push(v);
        }

        return array;
      };

      LZW = {
        compress: function (uncompressed) {
          "use strict"; // Build the dictionary.

          var i,
            dictionary = {},
            c,
            wc,
            w = "",
            result = [],
            dictSize = 256;

          for (i = 0; i < 256; i += 1) {
            dictionary[String.fromCharCode(i)] = i;
          }

          for (i = 0; i < uncompressed.length; i += 1) {
            c = uncompressed.charAt(i);
            wc = w + c; //Do not use dictionary[wc] because javascript arrays
            //will return values for array['pop'], array['push'] etc
            // if (dictionary[wc]) {

            if (dictionary.hasOwnProperty(wc)) {
              w = wc;
            } else {
              result.push(dictionary[w]); // Add wc to the dictionary.

              dictionary[wc] = dictSize++;
              w = String(c);
            }
          } // Output the code for w.


          if (w !== "") {
            result.push(dictionary[w]);
          }

          return result;
        },
        decompress: function (compressed) {
          "use strict"; // Build the dictionary.

          var i,
            dictionary = [],
            w,
            result,
            k,
            entry = "",
            dictSize = 256;

          for (i = 0; i < 256; i += 1) {
            dictionary[i] = String.fromCharCode(i);
          }

          w = String.fromCharCode(compressed[0]);
          result = w;

          for (i = 1; i < compressed.length; i += 1) {
            k = compressed[i];

            if (dictionary[k]) {
              entry = dictionary[k];
            } else {
              if (k === dictSize) {
                entry = w + w.charAt(0);
              } else {
                return null;
              }
            }

            result += entry;
            dictionary[dictSize++] = w + entry.charAt(0);
            w = entry;
          }

          return result;
        }
      };

      function objectToBytes(obj) {
        let payload = JSON.stringify(obj);
        payload = LZW.compress(payload);
        payload = FastIntegerCompression.compress(payload);
        return payload;
      }

      function bytesToObject(bytes) {
        if (bytes.byteLength > 0) {
          const data = FastIntegerCompression.uncompress(bytes);
          const str = LZW.decompress(data);
          return JSON.parse(str);
        } else return null;
      }

      module.exportDefault({
        compress: data => objectToBytes(data),
        uncompress: data => bytesToObject(data)
      });
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    }, "api.js": function module(require, exports, module) {

      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //                                                                                                                 //
      // server/api.js                                                                                                   //
      //                                                                                                                 //
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //
      let SseDataWorkerServer;
      module.link("./SseDataWorkerServer", {
        default(v) {
          SseDataWorkerServer = v;
        }

      }, 0);
      let configurationFile;
      module.link("./config", {
        default(v) {
          configurationFile = v;
        }

      }, 1);
      let basename;
      module.link("path", {
        basename(v) {
          basename = v;
        }

      }, 2);
      let readFile;
      module.link("fs", {
        readFile(v) {
          readFile = v;
        }

      }, 3);
      let THREE;
      module.link("three", {
        "*"(v) {
          THREE = v;
        }

      }, 4);
      let SsePCDLoader;
      module.link("../imports/editor/3d/SsePCDLoader", {
        default(v) {
          SsePCDLoader = v;
        }

      }, 5);
      WebApp.connectHandlers.use("/api/json", generateJson);
      WebApp.connectHandlers.use("/api/pcdtext", generatePCDOutput.bind({
        fileMode: false
      }));
      WebApp.connectHandlers.use("/api/pcdfile", generatePCDOutput.bind({
        fileMode: true
      }));
      WebApp.connectHandlers.use("/api/listing", imagesListing);
      const {
        imagesFolder,
        pointcloudsFolder,
        setsOfClassesMap
      } = configurationFile;
      new SsePCDLoader(THREE);

      function imagesListing(req, res, next) {
        const all = SseSamples.find({}, {
          fields: {
            url: 1,
            folder: 1,
            file: 1,
            tags: 1,
            firstEditDate: 1,
            lastEditDate: 1
          }
        }).fetch();
        res.end(JSON.stringify(all, null, 1));
      }

      function generateJson(req, res, next) {
        res.setHeader('Content-Type', 'application/json');
        const item = SseSamples.findOne({
          url: req.url
        });

        if (item) {
          const soc = setsOfClassesMap.get(item.socName);
          item.objects.forEach(obj => {
            obj.label = soc.objects[obj.classIndex].label;
          });
          res.end(JSON.stringify(item, null, 1));
        } else {
          res.end("{}");
        }
      }

      function generatePCDOutput(req, res, next) {
        const pcdFile = imagesFolder + decodeURIComponent(req.url);
        const fileName = basename(pcdFile);
        const labelFile = pointcloudsFolder + decodeURIComponent(req.url) + ".labels";
        const objectFile = pointcloudsFolder + decodeURIComponent(req.url) + ".objects";

        if (this.fileMode) {
          res.setHeader('Content-disposition', 'attachment; filename=DOC'.replace("DOC", fileName));
          res.setHeader('Content-type', 'text/plain');
          res.charset = 'UTF-8';
        }

        readFile(pcdFile, (err, content) => {
          if (err) {
            res.end("Error while parsing PCD file.");
          }

          const loader = new THREE.PCDLoader(true);
          const pcdContent = loader.parse(content.buffer, "");
          const hasRgb = pcdContent.rgb.length > 0;
          const head = pcdContent.header;

          const rgb2int = rgb => rgb[2] + 256 * rgb[1] + 256 * 256 * rgb[0];

          let out = "VERSION .7\n";
          out += hasRgb ? "FIELDS x y z rgb label object\n" : "FIELDS x y z label object\n";
          out += hasRgb ? "SIZE 4 4 4 4 4 4\n" : "SIZE 4 4 4 4 4\n";
          out += hasRgb ? "TYPE F F F I I I\n" : "TYPE F F F I I\n";
          out += hasRgb ? "COUNT 1 1 1 1 1 1\n" : "COUNT 1 1 1 1 1\n";
          out += "WIDTH " + pcdContent.header.width + "\n";
          out += "HEIGHT " + pcdContent.header.height + "\n";
          out += "POINTS " + pcdContent.header.width * pcdContent.header.height + "\n";
          out += "VIEWPOINT " + head.viewpoint.tx;
          out += " " + head.viewpoint.ty;
          out += " " + head.viewpoint.tz;
          out += " " + head.viewpoint.qw;
          out += " " + head.viewpoint.qx;
          out += " " + head.viewpoint.qy;
          out += " " + head.viewpoint.qz + "\n";
          out += "DATA ascii\n";
          res.write(out);
          out = "";
          readFile(labelFile, (labelErr, labelContent) => {
            if (labelErr) {
              res.end("Error while parsing labels file.");
            }

            const labels = SseDataWorkerServer.uncompress(labelContent);
            readFile(objectFile, (objectErr, objectContent) => {
              let objectsAvailable = true;

              if (objectErr) {
                objectsAvailable = false;
              }

              const objectByPointIndex = new Map();

              if (objectsAvailable) {
                const objects = SseDataWorkerServer.uncompress(objectContent);
                objects.forEach((obj, objIndex) => {
                  obj.points.forEach(ptIdx => {
                    objectByPointIndex.set(ptIdx, objIndex);
                  });
                });
              }

              let obj;
              pcdContent.position.forEach((v, i) => {
                const position = Math.floor(i / 3);

                switch (i % 3) {
                  case 0:
                    if (hasRgb) {
                      obj = {
                        rgb: pcdContent.rgb[position],
                        x: v
                      };
                    } else {
                      obj = {
                        x: v
                      };
                    }

                    break;

                  case 1:
                    obj.y = v;
                    break;

                  case 2:
                    obj.z = v;
                    out += obj.x + " " + obj.y + " " + obj.z + " ";

                    if (hasRgb) {
                      out += rgb2int(obj.rgb) + " ";
                    }

                    out += labels[position] + " ";
                    const assignedObject = objectByPointIndex.get(position);
                    if (assignedObject != undefined) out += assignedObject; else out += "-1";
                    out += "\n";
                    res.write(out);
                    out = "";
                    break;
                }
              });
              res.end();
            });
          });
        });
      }
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    }, "config.js": function module(require, exports, module) {

      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //                                                                                                                 //
      // server/config.js                                                                                                //
      //                                                                                                                 //
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //
      let Meteor;
      module.link("meteor/meteor", {
        Meteor(v) {
          Meteor = v;
        }

      }, 0);
      let join;
      module.link("path", {
        join(v) {
          join = v;
        }

      }, 1);
      let mkdirSync, existsSync;
      module.link("fs", {
        mkdirSync(v) {
          mkdirSync = v;
        },

        existsSync(v) {
          existsSync = v;
        }

      }, 2);
      let os;
      module.link("os", {
        default(v) {
          os = v;
        }

      }, 3);
      let download;
      module.link("download", {
        default(v) {
          download = v;
        }

      }, 4);
      const configurationFile = {};
      const defaultClasses = [{
        "name": "1 Class",
        "objects": [{
          "label": "Clayseam",
          "color": "#CFCFCF"
        }, {
          "label": "Clayseam"
        }]
      }];

      const init = () => {
        try {
          const config = Meteor.settings;

          if (config.configuration && config.configuration["images-folder"] != "") {
            configurationFile.imagesFolder = config.configuration["images-folder"].replace(/\/$/, "");
          } else {
            configurationFile.imagesFolder = join(os.homedir(), "sse-images");
          }

          if (!existsSync(configurationFile.imagesFolder)) {
            mkdirSync(configurationFile.imagesFolder);
            download("https://raw.githubusercontent.com/Hitachi-Automotive-And-Industry-Lab/semantic-segmentation-editor/master/private/samples/bitmap_labeling.png", configurationFile.imagesFolder);
            download("https://raw.githubusercontent.com/Hitachi-Automotive-And-Industry-Lab/semantic-segmentation-editor/master/private/samples/pointcloud_labeling.pcd", configurationFile.imagesFolder);
          }

          if (config.configuration && config.configuration["internal-folder"] != "") {
            configurationFile.pointcloudsFolder = config.configuration["internal-folder"].replace(/\/$/, "");
          } else {
            configurationFile.pointcloudsFolder = join(os.homedir(), "sse-internal");
          }

          configurationFile.setsOfClassesMap = new Map();
          configurationFile.setsOfClasses = config["sets-of-classes"];

          if (!configurationFile.setsOfClasses) {
            configurationFile.setsOfClasses = defaultClasses;
          }

          configurationFile.setsOfClasses.forEach(o => configurationFile.setsOfClassesMap.set(o.name, o));
          console.log("Semantic Segmentation Editor");
          console.log("Images (JPG, PNG, PCD) served from", configurationFile.imagesFolder);
          console.log("PCD binary segmentation data stored in", configurationFile.pointcloudsFolder);
          console.log("Number of available sets of object classes:", configurationFile.setsOfClasses.length);
          return configurationFile;
        } catch (e) {
          console.error("Error while parsing settings.json:", e);
        }
      };

      module.exportDefault(init());
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    }, "files.js": function module(require, exports, module) {

      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //                                                                                                                 //
      // server/files.js                                                                                                 //
      //                                                                                                                 //
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //
      let Meteor;
      module.link("meteor/meteor", {
        Meteor(v) {
          Meteor = v;
        }

      }, 0);
      let shell;
      module.link("shelljs", {
        default(v) {
          shell = v;
        }

      }, 1);
      let serveStatic;
      module.link("serve-static", {
        default(v) {
          serveStatic = v;
        }

      }, 2);
      let bodyParser;
      module.link("body-parser", {
        default(v) {
          bodyParser = v;
        }

      }, 3);
      let createWriteStream, lstatSync, readdirSync, readFile, readFileSync;
      module.link("fs", {
        createWriteStream(v) {
          createWriteStream = v;
        },

        lstatSync(v) {
          lstatSync = v;
        },

        readdirSync(v) {
          readdirSync = v;
        },

        readFile(v) {
          readFile = v;
        },

        readFileSync(v) {
          readFileSync = v;
        }

      }, 4);
      let basename, extname, join;
      module.link("path", {
        basename(v) {
          basename = v;
        },

        extname(v) {
          extname = v;
        },

        join(v) {
          join = v;
        }

      }, 5);
      let configurationFile;
      module.link("./config", {
        default(v) {
          configurationFile = v;
        }

      }, 6);
      //const demoMode = Meteor.settings.configuration["demo-mode"];
      Meteor.startup(() => {
        const {
          imagesFolder,
          pointcloudsFolder
        } = configurationFile;
        WebApp.connectHandlers.use("/file", serveStatic(imagesFolder, {
          fallthrough: false
        }));
        WebApp.connectHandlers.use("/datafile", serveStatic(pointcloudsFolder, {
          fallthrough: true
        }));
        WebApp.connectHandlers.use("/datafile", (req, res) => {
          res.end("");
        });
        WebApp.connectHandlers.use(bodyParser.raw({
          limit: "200mb",
          type: 'application/octet-stream'
        }));
        WebApp.connectHandlers.use('/save', function (req, res) {
          //if (demoMode) return;
          const fileToSave = pointcloudsFolder + decodeURIComponent(req.url).replace("/save", "");
          const dir = fileToSave.match("(.*\/).*")[1];
          shell.mkdir('-p', dir);
          var wstream = createWriteStream(fileToSave);
          wstream.write(req.body);
          wstream.end();
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
          res.end("Sent: " + fileToSave);
        });
      });
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    }, "main.js": function module(require, exports, module) {

      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //                                                                                                                 //
      // server/main.js                                                                                                  //
      //                                                                                                                 //
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      //
      let Meteor;
      module.link("meteor/meteor", {
        Meteor(v) {
          Meteor = v;
        }

      }, 0);
      let createWriteStream, lstatSync, readdirSync, readFile, readFileSync, existsSync;
      module.link("fs", {
        createWriteStream(v) {
          createWriteStream = v;
        },

        lstatSync(v) {
          lstatSync = v;
        },

        readdirSync(v) {
          readdirSync = v;
        },

        readFile(v) {
          readFile = v;
        },

        readFileSync(v) {
          readFileSync = v;
        },

        existsSync(v) {
          existsSync = v;
        }

      }, 1);
      let basename, extname, join;
      module.link("path", {
        basename(v) {
          basename = v;
        },

        extname(v) {
          extname = v;
        },

        join(v) {
          join = v;
        }

      }, 2);
      let url;
      module.link("url", {
        default(v) {
          url = v;
        }

      }, 3);
      let ColorScheme;
      module.link("color-scheme", {
        default(v) {
          ColorScheme = v;
        }

      }, 4);
      let config;
      module.link("./config", {
        default(v) {
          config = v;
        }

      }, 5);
      //const demoMode = Meteor.settings.configuration["demo-mode"];
      let {
        classes
      } = config;
      Meteor.methods({
        'getClassesSets'() {
          const data = config.setsOfClasses;
          const scheme = new ColorScheme();
          scheme.from_hue(0) // Start the scheme
            .scheme('tetrade') // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('soft'); // Use the 'soft' color variation

          let colors = scheme.colors();
          scheme.from_hue(10) // Start the scheme
            .scheme('tetrade') // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('pastel'); // Use the 'soft' color variation

          colors = colors.concat(scheme.colors());
          scheme.from_hue(20) // Start the scheme
            .scheme('tetrade') // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('hard'); // Use the 'soft' color variation

          colors = colors.concat(scheme.colors());
          scheme.from_hue(30) // Start the scheme
            .scheme('tetrade') // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('hard'); // Use the 'soft' color variation

          colors = colors.concat(scheme.colors());
          scheme.from_hue(40) // Start the scheme
            .scheme('tetrade') // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('hard'); // Use the 'soft' color variation

          colors = colors.concat(scheme.colors());
          colors = colors.map(c => "#" + c);
          data.forEach(soc => {
            soc.objects.forEach((oc, i) => {
              if (!oc.color) {
                oc.color = colors[i];
              }
            });
          });
          return data;
        },

        /*
            'rebuildTagList'() {
                const all = SseSamples.find().fetch();
                const tags = new Set();
                all.forEach(s => {
                    if (s.tags) {
                        s.tags.forEach(t => {
                            tags.add(t)
                        })
                    }
                });
                SseProps.remove({});
                SseProps.upsert({key: "tags"}, {key: "tags", value: Array.from(tags)});
            },
        */
        'images'(folder, pageIndex, pageLength) {
          const isDirectory = source => lstatSync(source).isDirectory();

          const isImage = source => {
            const stat = lstatSync(source);
            return (stat.isFile() || stat.isSymbolicLink()) && (extname(source).toLowerCase() == ".bmp" || extname(source).toLowerCase() == ".jpeg" || extname(source).toLowerCase() == ".jpg" || extname(source).toLowerCase() == ".pcd" || extname(source).toLowerCase() == ".png");
          };

          const getDirectories = source => readdirSync(source).map(name => join(source, name)).filter(isDirectory).map(a => basename(a));

          const getImages = source => readdirSync(source).map(name => join(source, name)).filter(isImage);

          const getImageDesc = path => {
            return {
              name: basename(path),
              editUrl: "/edit/" + encodeURIComponent(folderSlash + basename(path)),
              url: (folderSlash ? "/" + folderSlash : "") + "" + basename(path)
            };
          };

          const getFolderDesc = path => {
            return {
              name: basename(path),
              url: "/browse/".concat(pageIndex, "/").concat(pageLength, "/") + encodeURIComponent(folderSlash + path)
            };
          };

          pageIndex = parseInt(pageIndex);
          pageLength = parseInt(pageLength);
          const folderSlash = folder ? decodeURIComponent(folder) + "/" : "/";
          const leaf = join(config.imagesFolder, folderSlash ? folderSlash : "");
          const existing = existsSync(leaf);

          if (existing && !isDirectory(leaf)) {
            return {
              error: leaf + " is a file but should be a folder. Check the documentation and your settings.json"
            };
          }

          if (!existing) {
            return {
              error: leaf + " does not exists. Check the documentation and your settings.json"
            };
          }

          const dirs = getDirectories(leaf);
          const images = getImages(leaf);
          const res = {
            folders: dirs.map(getFolderDesc),
            images: images.map(getImageDesc).slice(pageIndex * pageLength, pageIndex * pageLength + pageLength),
            imagesCount: images.length
          };

          if (pageIndex * pageLength + pageLength < images.length) {
            res.nextPage = "/browse/".concat(pageIndex + 1, "/").concat(pageLength, "/") + (folder ? encodeURIComponent(folder) : "");
          }

          if (pageIndex > 0) {
            res.previousPage = "/browse/".concat(pageIndex - 1, "/").concat(pageLength, "/") + (folder ? encodeURIComponent(folder) : "");
          }

          return res;
        },

        'saveData'(sample) {
          //if (demoMode) return;
          const attrs = url.parse(sample.url);
          let path = decodeURIComponent(attrs.pathname);
          sample.folder = path.substring(1, path.lastIndexOf("/"));
          sample.file = path.substring(path.lastIndexOf("/") + 1);
          sample.lastEditDate = new Date();
          if (!sample.firstEditDate) sample.firstEditDate = new Date();

          if (sample.tags) {
            SseProps.upsert({
              key: "tags"
            }, {
              $addToSet: {
                value: {
                  $each: sample.tags
                }
              }
            });
          }

          SseSamples.upsert({
            url: sample.url
          }, sample);
        }

      });
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    }
  }
}, {
  "extensions": [
    ".js",
    ".json",
    ".jsx",
    ".mjs"
  ]
});

require("/lib/collections.js");
require("/server/SseDataWorkerServer.js");
require("/server/api.js");
require("/server/config.js");
require("/server/files.js");
require("/server/main.js");
//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvbGliL2NvbGxlY3Rpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2VkaXRvci8zZC9Tc2VQQ0RMb2FkZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9Tc2VEYXRhV29ya2VyU2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9zZXJ2ZXIvYXBpLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9zZXJ2ZXIvY29uZmlnLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9zZXJ2ZXIvZmlsZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9tYWluLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsIm1vZHVsZSIsImxpbmsiLCJ2IiwiU3NlU2FtcGxlcyIsIk1vbmdvIiwiQ29sbGVjdGlvbiIsIlNzZVByb3BzIiwiaXNTZXJ2ZXIiLCJwdWJsaXNoIiwiaW1hZ2VVcmwiLCJmaW5kIiwidXJsIiwiJHdoZXJlIiwiZmllbGRzIiwiZmlsZSIsImV4cG9ydCIsImRlZmF1bHQiLCJTc2VQQ0RMb2FkZXIiLCJjb25zdHJ1Y3RvciIsIlRIUkVFIiwiUENETG9hZGVyIiwic2VydmVyTW9kZSIsInByb3RvdHlwZSIsImxvYWQiLCJvbkxvYWQiLCJvblByb2dyZXNzIiwib25FcnJvciIsInNjb3BlIiwibG9hZGVyIiwiRmlsZUxvYWRlciIsIm1hbmFnZXIiLCJzZXRSZXNwb25zZVR5cGUiLCJkYXRhIiwicGFyc2UiLCJkZWNvbXByZXNzTFpGIiwiaW5EYXRhIiwib3V0TGVuZ3RoIiwiaW5MZW5ndGgiLCJsZW5ndGgiLCJvdXREYXRhIiwiVWludDhBcnJheSIsImluUHRyIiwib3V0UHRyIiwiY3RybCIsImxlbiIsInJlZiIsIkVycm9yIiwicGFyc2VIZWFkZXIiLCJQQ0RoZWFkZXIiLCJyZXN1bHQxIiwic2VhcmNoIiwicmVzdWx0MiIsImV4ZWMiLCJzdWJzdHIiLCJoZWFkZXJMZW4iLCJzdHIiLCJyZXBsYWNlIiwidmVyc2lvbiIsInNpemUiLCJ0eXBlIiwiY291bnQiLCJ3aWR0aCIsImhlaWdodCIsInZpZXdwb2ludCIsInBvaW50cyIsInBhcnNlRmxvYXQiLCJzcGxpdCIsInBhcnNlSW50IiwibWFwIiwieCIsInR4IiwidHkiLCJ0eiIsInF3IiwicXgiLCJxeSIsInF6IiwiaSIsImwiLCJwdXNoIiwib2Zmc2V0Iiwic2l6ZVN1bSIsInJvd1NpemUiLCJ0ZXh0RGF0YSIsIkJ1ZmZlciIsImZyb20iLCJ0b1N0cmluZyIsIkxvYWRlclV0aWxzIiwiZGVjb2RlVGV4dCIsInBvc2l0aW9uIiwiY29sb3IiLCJsYWJlbCIsInBheWxvYWQiLCJyZ2IiLCJtZXRhIiwiY2FtUG9zaXRpb24iLCJWZWN0b3IzIiwiY2FtUXVhdGVybmlvbiIsIlF1YXRlcm5pb24iLCJwY2REYXRhIiwibGluZXMiLCJwdCIsIml0ZW0iLCJsaW5lIiwieSIsInoiLCJzdWIiLCJhcHBseVF1YXRlcm5pb24iLCJ1bmRlZmluZWQiLCJjbGFzc0luZGV4IiwiY29sb3JSR0IiLCJyIiwiZyIsImIiLCJkYXRhdmlldyIsIkRhdGFWaWV3Iiwic2xpY2UiLCJjb21wcmVzc2VkU2l6ZSIsImdldFVpbnQzMiIsImRlY29tcHJlc3NlZFNpemUiLCJkZWNvbXByZXNzZWQiLCJidWZmZXIiLCJnZXRGbG9hdDMyIiwiZ2V0VWludDgiLCJyb3ciLCJnZW9tZXRyeSIsIkJ1ZmZlckdlb21ldHJ5Iiwic2V0QXR0cmlidXRlIiwiRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSIsIlVpbnQ4QnVmZmVyQXR0cmlidXRlIiwiY29sb3JBdHQiLCJjb21wdXRlQm91bmRpbmdTcGhlcmUiLCJtYXRlcmlhbCIsIlBvaW50c01hdGVyaWFsIiwic2l6ZUF0dGVudWF0aW9uIiwibWVzaCIsIlBvaW50cyIsIm5hbWUiLCJyZXZlcnNlIiwiam9pbiIsImhlYWRlciIsIkZhc3RJbnRlZ2VyQ29tcHJlc3Npb24iLCJieXRlbG9nIiwidmFsIiwiY29tcHV0ZUNvbXByZXNzZWRTaXplSW5CeXRlcyIsImlucHV0IiwiYyIsImFuc3dlciIsImNvbXByZXNzIiwiYnVmIiwiQXJyYXlCdWZmZXIiLCJ2aWV3IiwiSW50OEFycmF5IiwicG9zIiwiY29tcHV0ZUhvd01hbnlJbnRlZ2VycyIsInVuY29tcHJlc3MiLCJhcnJheSIsImluYnl0ZSIsImVuZCIsIkxaVyIsInVuY29tcHJlc3NlZCIsImRpY3Rpb25hcnkiLCJ3YyIsInciLCJyZXN1bHQiLCJkaWN0U2l6ZSIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImNoYXJBdCIsImhhc093blByb3BlcnR5IiwiZGVjb21wcmVzcyIsImNvbXByZXNzZWQiLCJrIiwiZW50cnkiLCJvYmplY3RUb0J5dGVzIiwib2JqIiwiSlNPTiIsInN0cmluZ2lmeSIsImJ5dGVzVG9PYmplY3QiLCJieXRlcyIsImJ5dGVMZW5ndGgiLCJleHBvcnREZWZhdWx0IiwiU3NlRGF0YVdvcmtlclNlcnZlciIsImNvbmZpZ3VyYXRpb25GaWxlIiwiYmFzZW5hbWUiLCJyZWFkRmlsZSIsIldlYkFwcCIsImNvbm5lY3RIYW5kbGVycyIsInVzZSIsImdlbmVyYXRlSnNvbiIsImdlbmVyYXRlUENET3V0cHV0IiwiYmluZCIsImZpbGVNb2RlIiwiaW1hZ2VzTGlzdGluZyIsImltYWdlc0ZvbGRlciIsInBvaW50Y2xvdWRzRm9sZGVyIiwic2V0c09mQ2xhc3Nlc01hcCIsInJlcSIsInJlcyIsIm5leHQiLCJhbGwiLCJmb2xkZXIiLCJ0YWdzIiwiZmlyc3RFZGl0RGF0ZSIsImxhc3RFZGl0RGF0ZSIsImZldGNoIiwic2V0SGVhZGVyIiwiZmluZE9uZSIsInNvYyIsImdldCIsInNvY05hbWUiLCJvYmplY3RzIiwiZm9yRWFjaCIsInBjZEZpbGUiLCJkZWNvZGVVUklDb21wb25lbnQiLCJmaWxlTmFtZSIsImxhYmVsRmlsZSIsIm9iamVjdEZpbGUiLCJjaGFyc2V0IiwiZXJyIiwiY29udGVudCIsInBjZENvbnRlbnQiLCJoYXNSZ2IiLCJoZWFkIiwicmdiMmludCIsIm91dCIsIndyaXRlIiwibGFiZWxFcnIiLCJsYWJlbENvbnRlbnQiLCJsYWJlbHMiLCJvYmplY3RFcnIiLCJvYmplY3RDb250ZW50Iiwib2JqZWN0c0F2YWlsYWJsZSIsIm9iamVjdEJ5UG9pbnRJbmRleCIsIk1hcCIsIm9iakluZGV4IiwicHRJZHgiLCJzZXQiLCJNYXRoIiwiZmxvb3IiLCJhc3NpZ25lZE9iamVjdCIsIm1rZGlyU3luYyIsImV4aXN0c1N5bmMiLCJvcyIsImRvd25sb2FkIiwiZGVmYXVsdENsYXNzZXMiLCJpbml0IiwiY29uZmlnIiwic2V0dGluZ3MiLCJjb25maWd1cmF0aW9uIiwiaG9tZWRpciIsInNldHNPZkNsYXNzZXMiLCJvIiwiY29uc29sZSIsImxvZyIsImUiLCJlcnJvciIsInNoZWxsIiwic2VydmVTdGF0aWMiLCJib2R5UGFyc2VyIiwiY3JlYXRlV3JpdGVTdHJlYW0iLCJsc3RhdFN5bmMiLCJyZWFkZGlyU3luYyIsInJlYWRGaWxlU3luYyIsImV4dG5hbWUiLCJkZW1vTW9kZSIsInN0YXJ0dXAiLCJmYWxsdGhyb3VnaCIsInJhdyIsImxpbWl0IiwiZmlsZVRvU2F2ZSIsImRpciIsIm1hdGNoIiwibWtkaXIiLCJ3c3RyZWFtIiwiYm9keSIsIkNvbG9yU2NoZW1lIiwiY2xhc3NlcyIsIm1ldGhvZHMiLCJzY2hlbWUiLCJmcm9tX2h1ZSIsInZhcmlhdGlvbiIsImNvbG9ycyIsImNvbmNhdCIsIm9jIiwicGFnZUluZGV4IiwicGFnZUxlbmd0aCIsImlzRGlyZWN0b3J5Iiwic291cmNlIiwiaXNJbWFnZSIsInN0YXQiLCJpc0ZpbGUiLCJpc1N5bWJvbGljTGluayIsInRvTG93ZXJDYXNlIiwiZ2V0RGlyZWN0b3JpZXMiLCJmaWx0ZXIiLCJhIiwiZ2V0SW1hZ2VzIiwiZ2V0SW1hZ2VEZXNjIiwicGF0aCIsImVkaXRVcmwiLCJlbmNvZGVVUklDb21wb25lbnQiLCJmb2xkZXJTbGFzaCIsImdldEZvbGRlckRlc2MiLCJsZWFmIiwiZXhpc3RpbmciLCJkaXJzIiwiaW1hZ2VzIiwiZm9sZGVycyIsImltYWdlc0NvdW50IiwibmV4dFBhZ2UiLCJwcmV2aW91c1BhZ2UiLCJzYW1wbGUiLCJhdHRycyIsInBhdGhuYW1lIiwic3Vic3RyaW5nIiwibGFzdEluZGV4T2YiLCJEYXRlIiwidXBzZXJ0Iiwia2V5IiwiJGFkZFRvU2V0IiwidmFsdWUiLCIkZWFjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxJQUFJQSxNQUFKO0FBQVdDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ0YsUUFBTSxDQUFDRyxDQUFELEVBQUc7QUFBQ0gsVUFBTSxHQUFDRyxDQUFQO0FBQVM7O0FBQXBCLENBQTVCLEVBQWtELENBQWxEO0FBRVhDLFVBQVUsR0FBRyxJQUFJQyxLQUFLLENBQUNDLFVBQVYsQ0FBcUIsWUFBckIsQ0FBYjtBQUNBQyxRQUFRLEdBQUcsSUFBSUYsS0FBSyxDQUFDQyxVQUFWLENBQXFCLFVBQXJCLENBQVg7O0FBRUEsSUFBSU4sTUFBTSxDQUFDUSxRQUFYLEVBQXFCO0FBQ2pCUixRQUFNLENBQUNTLE9BQVAsQ0FBZSxxQkFBZixFQUFzQyxVQUFVQyxRQUFWLEVBQW9CO0FBQ3RELFdBQU9OLFVBQVUsQ0FBQ08sSUFBWCxDQUFnQjtBQUFDQyxTQUFHLEVBQUVGO0FBQU4sS0FBaEIsQ0FBUDtBQUNILEdBRkQ7QUFJQVYsUUFBTSxDQUFDUyxPQUFQLENBQWUsb0JBQWYsRUFBcUMsWUFBWTtBQUM3QyxXQUFPTCxVQUFVLENBQUNPLElBQVgsQ0FDSDtBQUFDRSxZQUFNLEVBQUU7QUFBVCxLQURHLEVBRUg7QUFBQ0MsWUFBTSxFQUFFO0FBQUNDLFlBQUksRUFBRSxDQUFQO0FBQVVILFdBQUcsRUFBRTtBQUFmO0FBQVQsS0FGRyxDQUFQO0FBSUgsR0FMRDtBQU9BWixRQUFNLENBQUNTLE9BQVAsQ0FBZSxXQUFmLEVBQTRCLFlBQVk7QUFDcEMsV0FBT0YsUUFBUSxDQUFDSSxJQUFULENBQWMsRUFBZCxDQUFQO0FBQ0gsR0FGRDtBQUdILEM7Ozs7Ozs7Ozs7O0FDcEJEVixNQUFNLENBQUNlLE1BQVAsQ0FBYztBQUFDQyxTQUFPLEVBQUMsTUFB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LFFBQUksQ0FBQ0wsTUFBTSxDQUFDN0csYUFBWixFQUNJNkcsTUFBTSxDQUFDN0csYUFBUCxHQUF1QixJQUFJa0gsSUFBSixFQUF2Qjs7QUFDSixRQUFJTCxNQUFNLENBQUM5RyxJQUFYLEVBQWlCO0FBQ2JwTSxjQUFRLENBQUN3VCxNQUFULENBQWdCO0FBQUNDLFdBQUcsRUFBRTtBQUFOLE9BQWhCLEVBQStCO0FBQUNDLGlCQUFTLEVBQUU7QUFBQ0MsZUFBSyxFQUFFO0FBQUNDLGlCQUFLLEVBQUVWLE1BQU0sQ0FBQzlHO0FBQWY7QUFBUjtBQUFaLE9BQS9CO0FBQ0g7O0FBQ0R2TSxjQUFVLENBQUMyVCxNQUFYLENBQWtCO0FBQUNuVCxTQUFHLEVBQUU2UyxNQUFNLENBQUM3UztBQUFiLEtBQWxCLEVBQXFDNlMsTUFBckM7QUFDSDs7QUExSVUsQ0FBZixFIiwiZmlsZSI6Ii9hcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01ldGVvcn0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cblNzZVNhbXBsZXMgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbihcIlNzZVNhbXBsZXNcIik7XG5Tc2VQcm9wcyA9IG5ldyBNb25nby5Db2xsZWN0aW9uKFwiU3NlUHJvcHNcIik7XG5cbmlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICBNZXRlb3IucHVibGlzaChcInNzZS1kYXRhLWRlc2NyaXB0b3JcIiwgZnVuY3Rpb24gKGltYWdlVXJsKSB7XG4gICAgICAgIHJldHVybiBTc2VTYW1wbGVzLmZpbmQoe3VybDogaW1hZ2VVcmx9KTtcbiAgICB9KTtcblxuICAgIE1ldGVvci5wdWJsaXNoKFwic3NlLWxhYmVsZWQtaW1hZ2VzXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFNzZVNhbXBsZXMuZmluZChcbiAgICAgICAgICAgIHskd2hlcmU6ICd0aGlzLm9iamVjdHMgJiYgdGhpcy5vYmplY3RzLmxlbmd0aD4wJ30sXG4gICAgICAgICAgICB7ZmllbGRzOiB7ZmlsZTogMSwgdXJsOiAxfX0sXG4gICAgICAgICk7XG4gICAgfSk7XG5cbiAgICBNZXRlb3IucHVibGlzaCgnc3NlLXByb3BzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gU3NlUHJvcHMuZmluZCh7fSk7XG4gICAgfSk7XG59XG5cbiIsIi8vIEJhc2VkIG9uIHRocmVlLmpzIFBDRExvYWRlciBjbGFzcyAob25seSBzdXBwb3J0IEFTQ0lJIFBDRCBmaWxlcylcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNzZVBDRExvYWRlciB7XG4gICAgY29uc3RydWN0b3IoVEhSRUUpIHtcbiAgICAgICAgVEhSRUUuUENETG9hZGVyID0gZnVuY3Rpb24gKHNlcnZlck1vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuc2VydmVyTW9kZSA9IHNlcnZlck1vZGU7XG4gICAgICAgIH07XG5cbiAgICAgICAgVEhSRUUuUENETG9hZGVyLnByb3RvdHlwZSA9IHtcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBUSFJFRS5QQ0RMb2FkZXIsXG4gICAgICAgICAgICBsb2FkOiBmdW5jdGlvbiAodXJsLCBvbkxvYWQsIG9uUHJvZ3Jlc3MsIG9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgICAgICAgICAgICAgIHZhciBsb2FkZXIgPSBuZXcgVEhSRUUuRmlsZUxvYWRlcihzY29wZS5tYW5hZ2VyKTtcbiAgICAgICAgICAgICAgICBsb2FkZXIuc2V0UmVzcG9uc2VUeXBlKCdhcnJheWJ1ZmZlcicpO1xuICAgICAgICAgICAgICAgIGxvYWRlci5sb2FkKHVybCwgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgb25Mb2FkKHNjb3BlLnBhcnNlKGRhdGEsIHVybCkpO1xuICAgICAgICAgICAgICAgIH0sIG9uUHJvZ3Jlc3MsIG9uRXJyb3IpO1xuXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBwYXJzZTogZnVuY3Rpb24gKGRhdGEsIHVybCkge1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGRlY29tcHJlc3NMWkYoIGluRGF0YSwgb3V0TGVuZ3RoICkge1xuICAgICAgICAgICAgICAgICAgICAvLyBmcm9tIGh0dHBzOi8vZ2l0bGFiLmNvbS90YWtldHdvL3RocmVlLXBjZC1sb2FkZXIvYmxvYi9tYXN0ZXIvZGVjb21wcmVzcy1semYuanNcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluTGVuZ3RoID0gaW5EYXRhLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG91dERhdGEgPSBuZXcgVWludDhBcnJheSggb3V0TGVuZ3RoICk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpblB0ciA9IDA7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvdXRQdHIgPSAwO1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3RybDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxlbjtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlZjtcbiAgICAgICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3RybCA9IGluRGF0YVsgaW5QdHIgKysgXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggY3RybCA8ICggMSA8PCA1ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3RybCArKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIG91dFB0ciArIGN0cmwgPiBvdXRMZW5ndGggKSB0aHJvdyBuZXcgRXJyb3IoICdPdXRwdXQgYnVmZmVyIGlzIG5vdCBsYXJnZSBlbm91Z2gnICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpblB0ciArIGN0cmwgPiBpbkxlbmd0aCApIHRocm93IG5ldyBFcnJvciggJ0ludmFsaWQgY29tcHJlc3NlZCBkYXRhJyApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0RGF0YVsgb3V0UHRyICsrIF0gPSBpbkRhdGFbIGluUHRyICsrIF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoIC0tIGN0cmwgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVuID0gY3RybCA+PiA1O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZiA9IG91dFB0ciAtICggKCBjdHJsICYgMHgxZiApIDw8IDggKSAtIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpblB0ciA+PSBpbkxlbmd0aCApIHRocm93IG5ldyBFcnJvciggJ0ludmFsaWQgY29tcHJlc3NlZCBkYXRhJyApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggbGVuID09PSA3ICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZW4gKz0gaW5EYXRhWyBpblB0ciArKyBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGluUHRyID49IGluTGVuZ3RoICkgdGhyb3cgbmV3IEVycm9yKCAnSW52YWxpZCBjb21wcmVzc2VkIGRhdGEnICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZiAtPSBpbkRhdGFbIGluUHRyICsrIF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBvdXRQdHIgKyBsZW4gKyAyID4gb3V0TGVuZ3RoICkgdGhyb3cgbmV3IEVycm9yKCAnT3V0cHV0IGJ1ZmZlciBpcyBub3QgbGFyZ2UgZW5vdWdoJyApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggcmVmIDwgMCApIHRocm93IG5ldyBFcnJvciggJ0ludmFsaWQgY29tcHJlc3NlZCBkYXRhJyApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggcmVmID49IG91dFB0ciApIHRocm93IG5ldyBFcnJvciggJ0ludmFsaWQgY29tcHJlc3NlZCBkYXRhJyApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0RGF0YVsgb3V0UHRyICsrIF0gPSBvdXREYXRhWyByZWYgKysgXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IHdoaWxlICggLS0gbGVuICsgMiApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IHdoaWxlICggaW5QdHIgPCBpbkxlbmd0aCApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3V0RGF0YTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBwYXJzZUhlYWRlcihkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBQQ0RoZWFkZXIgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdDEgPSBkYXRhLnNlYXJjaCgvW1xcclxcbl1EQVRBXFxzKFxcUyopXFxzL2kpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0MiA9IC9bXFxyXFxuXURBVEFcXHMoXFxTKilcXHMvaS5leGVjKGRhdGEuc3Vic3RyKHJlc3VsdDEgLSAxKSk7XG4gICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5kYXRhID0gcmVzdWx0MlsxXTtcbiAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLmhlYWRlckxlbiA9IHJlc3VsdDJbMF0ubGVuZ3RoICsgcmVzdWx0MTtcbiAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLnN0ciA9IGRhdGEuc3Vic3RyKDAsIFBDRGhlYWRlci5oZWFkZXJMZW4pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBjb21tZW50c1xuICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuc3RyID0gUENEaGVhZGVyLnN0ci5yZXBsYWNlKC9cXCMuKi9naSwgJycpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlXG4gICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci52ZXJzaW9uID0gL1ZFUlNJT04gKC4qKS9pLmV4ZWMoUENEaGVhZGVyLnN0cik7XG4gICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5maWVsZHMgPSAvRklFTERTICguKikvaS5leGVjKFBDRGhlYWRlci5zdHIpO1xuICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuc2l6ZSA9IC9TSVpFICguKikvaS5leGVjKFBDRGhlYWRlci5zdHIpO1xuICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIudHlwZSA9IC9UWVBFICguKikvaS5leGVjKFBDRGhlYWRlci5zdHIpO1xuICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuY291bnQgPSAvQ09VTlQgKC4qKS9pLmV4ZWMoUENEaGVhZGVyLnN0cik7XG4gICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci53aWR0aCA9IC9XSURUSCAoLiopL2kuZXhlYyhQQ0RoZWFkZXIuc3RyKTtcbiAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLmhlaWdodCA9IC9IRUlHSFQgKC4qKS9pLmV4ZWMoUENEaGVhZGVyLnN0cik7XG4gICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci52aWV3cG9pbnQgPSAvVklFV1BPSU5UICguKikvaS5leGVjKFBDRGhlYWRlci5zdHIpO1xuICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIucG9pbnRzID0gL1BPSU5UUyAoLiopL2kuZXhlYyhQQ0RoZWFkZXIuc3RyKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gZXZhbHVhdGVcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBDRGhlYWRlci52ZXJzaW9uICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLnZlcnNpb24gPSBwYXJzZUZsb2F0KFBDRGhlYWRlci52ZXJzaW9uWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBDRGhlYWRlci5maWVsZHMgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuZmllbGRzID0gUENEaGVhZGVyLmZpZWxkc1sxXS5zcGxpdCgnICcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUENEaGVhZGVyLnR5cGUgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIudHlwZSA9IFBDRGhlYWRlci50eXBlWzFdLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChQQ0RoZWFkZXIud2lkdGggIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIud2lkdGggPSBwYXJzZUludChQQ0RoZWFkZXIud2lkdGhbMV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUENEaGVhZGVyLmhlaWdodCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5oZWlnaHQgPSBwYXJzZUludChQQ0RoZWFkZXIuaGVpZ2h0WzFdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBDRGhlYWRlci52aWV3cG9pbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIudmlld3BvaW50ID0gUENEaGVhZGVyLnZpZXdwb2ludFsxXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBDRGhlYWRlci5wb2ludHMgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIucG9pbnRzID0gcGFyc2VJbnQoUENEaGVhZGVyLnBvaW50c1sxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUENEaGVhZGVyLnBvaW50cyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5wb2ludHMgPSBQQ0RoZWFkZXIud2lkdGggKiBQQ0RoZWFkZXIuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBpZiAoUENEaGVhZGVyLnNpemUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5zaXplID0gUENEaGVhZGVyLnNpemVbMV0uc3BsaXQoJyAnKS5tYXAoZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoeCwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcGxpdCA9IFBDRGhlYWRlci52aWV3cG9pbnQuc3BsaXQoXCIgXCIpO1xuICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIudmlld3BvaW50ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHg6IHNwbGl0WzBdLCB0eTogc3BsaXRbMV0sIHR6OiBzcGxpdFsyXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF3OiBzcGxpdFszXSwgcXg6IHNwbGl0WzRdLCBxeTogc3BsaXRbNV0sIHF6OiBzcGxpdFs2XVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoUENEaGVhZGVyLmNvdW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuY291bnQgPSBQQ0RoZWFkZXIuY291bnRbMV0uc3BsaXQoJyAnKS5tYXAoZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoeCwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuY291bnQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gUENEaGVhZGVyLmZpZWxkcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIuY291bnQucHVzaCgxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5vZmZzZXQgPSB7fTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgc2l6ZVN1bSA9IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBQQ0RoZWFkZXIuZmllbGRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFBDRGhlYWRlci5kYXRhID09PSAnYXNjaWknKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLm9mZnNldFtQQ0RoZWFkZXIuZmllbGRzW2ldXSA9IGk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBDRGhlYWRlci5vZmZzZXRbUENEaGVhZGVyLmZpZWxkc1tpXV0gPSBzaXplU3VtO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemVTdW0gKz0gUENEaGVhZGVyLnNpemVbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLnJvd1NpemUgPSBzaXplU3VtO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUENEaGVhZGVyO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciB0ZXh0RGF0YSA9IHRoaXMuc2VydmVyTW9kZSA/IChCdWZmZXIuZnJvbShkYXRhKSkudG9TdHJpbmcoKSA6IFRIUkVFLkxvYWRlclV0aWxzLmRlY29kZVRleHQoZGF0YSk7XG5cbiAgICAgICAgICAgICAgICAvLyBwYXJzZSBoZWFkZXIgKGFsd2F5cyBhc2NpaSBmb3JtYXQpXG4gICAgICAgICAgICAgICAgdmFyIFBDRGhlYWRlciA9IHBhcnNlSGVhZGVyKHRleHREYXRhKTtcblxuICAgICAgICAgICAgICAgIC8vIHBhcnNlIGRhdGFcblxuICAgICAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBjb2xvciA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBsYWJlbCA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBwYXlsb2FkID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHJnYiA9IFtdO1xuXG4gICAgICAgICAgICAgICAgaWYgKFBDRGhlYWRlci5kYXRhID09PSAnYXNjaWknKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1ldGEgPSBQQ0RoZWFkZXI7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGNhbVBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMocGFyc2VGbG9hdChtZXRhLnZpZXdwb2ludC50eCksIHBhcnNlRmxvYXQobWV0YS52aWV3cG9pbnQudHkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VGbG9hdChtZXRhLnZpZXdwb2ludC50eikpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgY2FtUXVhdGVybmlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKG1ldGEudmlld3BvaW50LnF4LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0YS52aWV3cG9pbnQucXksIG1ldGEudmlld3BvaW50LnF6LCBtZXRhLnZpZXdwb2ludC5xdyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9mZnNldCA9IFBDRGhlYWRlci5vZmZzZXQ7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHBjZERhdGEgPSB0ZXh0RGF0YS5zdWJzdHIoUENEaGVhZGVyLmhlYWRlckxlbik7XG4gICAgICAgICAgICAgICAgICAgIHZhciBsaW5lcyA9IHBjZERhdGEuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcHQsIGl0ZW07XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGluZXMubGVuZ3RoIC0gMTsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYobGluZXNbaV0gPT0gXCJcIil7Y29udGludWU7fSAgLy8gU29tZXRpbWVzIGVtcHR5IGxpbmVzIGFyZSBpbnNlcnRlZC4uLlxuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGluZSA9IGxpbmVzW2ldLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLnB1c2goaXRlbSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHB0ID0gbmV3IFRIUkVFLlZlY3RvcjMocGFyc2VGbG9hdChsaW5lW29mZnNldC54XSksIHBhcnNlRmxvYXQobGluZVtvZmZzZXQueV0pLCBwYXJzZUZsb2F0KGxpbmVbb2Zmc2V0LnpdKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5zZXJ2ZXJNb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHQgPSBwdC5zdWIoY2FtUG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHB0LmFwcGx5UXVhdGVybmlvbihjYW1RdWF0ZXJuaW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS54ID0gcHQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uLnB1c2gocHQueCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ueSA9IHB0Lnk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbi5wdXNoKHB0LnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS56ID0gcHQuejtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uLnB1c2gocHQueik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvZmZzZXQubGFiZWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzSW5kZXggPSBwYXJzZUludChsaW5lW29mZnNldC5sYWJlbF0pIHx8IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5jbGFzc0luZGV4ID0gY2xhc3NJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbC5wdXNoKGNsYXNzSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLmNsYXNzSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsLnB1c2goMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEluaXRpYWxpemUgY29sb3JzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2Zmc2V0LnJnYiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sb3JSR0IgPSBwYXJzZUludChsaW5lW29mZnNldC5yZ2JdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgciA9IChjb2xvclJHQiA+PiAxNikgJiAweDAwMDBmZjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZyA9IChjb2xvclJHQiA+PiA4KSAmIDB4MDAwMGZmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiID0gKGNvbG9yUkdCKSAmIDB4MDAwMGZmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYi5wdXNoKFtyLCBnLCBiXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yLnB1c2goMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvci5wdXNoKDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IucHVzaCgwKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYmluYXJ5LWNvbXByZXNzZWRcbiAgICAgICAgICAgICAgICAvLyBub3JtYWxseSBkYXRhIGluIFBDRCBmaWxlcyBhcmUgb3JnYW5pemVkIGFzIGFycmF5IG9mIHN0cnVjdHVyZXM6IFhZWlJHQlhZWlJHQlxuICAgICAgICAgICAgICAgIC8vIGJpbmFyeSBjb21wcmVzc2VkIFBDRCBmaWxlcyBvcmdhbml6ZSB0aGVpciBkYXRhIGFzIHN0cnVjdHVyZSBvZiBhcnJheXM6IFhYWVlaWlJHQlJHQlxuICAgICAgICAgICAgICAgIC8vIHRoYXQgcmVxdWlyZXMgYSB0b3RhbGx5IGRpZmZlcmVudCBwYXJzaW5nIGFwcHJvYWNoIGNvbXBhcmVkIHRvIG5vbi1jb21wcmVzc2VkIGRhdGFcbiAgICAgICAgICAgICAgICBpZiAoIFBDRGhlYWRlci5kYXRhID09PSAnYmluYXJ5X2NvbXByZXNzZWQnICkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YXZpZXcgPSBuZXcgRGF0YVZpZXcoIGRhdGEuc2xpY2UoIFBDRGhlYWRlci5oZWFkZXJMZW4sIFBDRGhlYWRlci5oZWFkZXJMZW4gKyA4ICkgKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbXByZXNzZWRTaXplID0gZGF0YXZpZXcuZ2V0VWludDMyKCAwLCB0cnVlICk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkZWNvbXByZXNzZWRTaXplID0gZGF0YXZpZXcuZ2V0VWludDMyKCA0LCB0cnVlICk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkZWNvbXByZXNzZWQgPSBkZWNvbXByZXNzTFpGKCBuZXcgVWludDhBcnJheSggZGF0YSwgUENEaGVhZGVyLmhlYWRlckxlbiArIDgsIGNvbXByZXNzZWRTaXplICksIGRlY29tcHJlc3NlZFNpemUgKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YXZpZXcgPSBuZXcgRGF0YVZpZXcoIGRlY29tcHJlc3NlZC5idWZmZXIgKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgb2Zmc2V0ID0gUENEaGVhZGVyLm9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHB0LCBpdGVtO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBjYW1Qb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKHBhcnNlRmxvYXQoUENEaGVhZGVyLnZpZXdwb2ludC50eCksIHBhcnNlRmxvYXQoUENEaGVhZGVyLnZpZXdwb2ludC50eSksXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUZsb2F0KFBDRGhlYWRlci52aWV3cG9pbnQudHopKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNhbVF1YXRlcm5pb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbihQQ0RoZWFkZXIudmlld3BvaW50LnF4LFxuICAgICAgICAgICAgICAgICAgICAgICAgUENEaGVhZGVyLnZpZXdwb2ludC5xeSwgUENEaGVhZGVyLnZpZXdwb2ludC5xeiwgUENEaGVhZGVyLnZpZXdwb2ludC5xdyk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgUENEaGVhZGVyLnBvaW50czsgaSArKyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBheWxvYWQucHVzaChpdGVtKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeCA9IGRhdGF2aWV3LmdldEZsb2F0MzIoICggUENEaGVhZGVyLnBvaW50cyAqIG9mZnNldC54ICkgKyBQQ0RoZWFkZXIuc2l6ZVsgMCBdICogaSwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeSA9IGRhdGF2aWV3LmdldEZsb2F0MzIoICggUENEaGVhZGVyLnBvaW50cyAqIG9mZnNldC55ICkgKyBQQ0RoZWFkZXIuc2l6ZVsgMSBdICogaSwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeiA9IGRhdGF2aWV3LmdldEZsb2F0MzIoICggUENEaGVhZGVyLnBvaW50cyAqIG9mZnNldC56ICkgKyBQQ0RoZWFkZXIuc2l6ZVsgMiBdICogaSwgdHJ1ZSApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBwdCA9IG5ldyBUSFJFRS5WZWN0b3IzKHgsIHksIHopO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc2VydmVyTW9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHB0ID0gcHQuc3ViKGNhbVBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwdC5hcHBseVF1YXRlcm5pb24oY2FtUXVhdGVybmlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ueCA9IHB0Lng7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbi5wdXNoKHB0LngpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnkgPSBwdC55O1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24ucHVzaChwdC55KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ueiA9IHB0Lno7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbi5wdXNoKHB0LnopO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIG9mZnNldC5sYWJlbCAhPT0gdW5kZWZpbmVkICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzSW5kZXggPSBkYXRhdmlldy5nZXRVaW50OCggUENEaGVhZGVyLnBvaW50cyAqIG9mZnNldC5sYWJlbCArIFBDRGhlYWRlci5zaXplWyAzIF0gKiBpICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5jbGFzc0luZGV4ID0gY2xhc3NJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbC5wdXNoKCBjbGFzc0luZGV4ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uY2xhc3NJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWwucHVzaCgwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBjb2xvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvZmZzZXQucmdiICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xvclJHQiA9IGRhdGF2aWV3LmdldFVpbnQzMihyb3cgKyBvZmZzZXQucmdiLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgciA9IChjb2xvclJHQiA+PiAxNikgJiAweDAwMDBmZjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZyA9IChjb2xvclJHQiA+PiA4KSAmIDB4MDAwMGZmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiID0gKGNvbG9yUkdCKSAmIDB4MDAwMGZmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYi5wdXNoKFtyLCBnLCBiXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yLnB1c2goMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvci5wdXNoKDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IucHVzaCgwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGJpbmFyeVxuXG4gICAgICAgICAgICAgICAgaWYgKCBQQ0RoZWFkZXIuZGF0YSA9PT0gJ2JpbmFyeScgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhdmlldyA9IG5ldyBEYXRhVmlldyggZGF0YSwgUENEaGVhZGVyLmhlYWRlckxlbiApO1xuICAgICAgICAgICAgICAgICAgICB2YXIgb2Zmc2V0ID0gUENEaGVhZGVyLm9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHB0LCBpdGVtO1xuICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0LnB1c2gob2Zmc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNhbVBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMocGFyc2VGbG9hdChQQ0RoZWFkZXIudmlld3BvaW50LnR4KSwgcGFyc2VGbG9hdChQQ0RoZWFkZXIudmlld3BvaW50LnR5KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlRmxvYXQoUENEaGVhZGVyLnZpZXdwb2ludC50eikpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgY2FtUXVhdGVybmlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKFBDRGhlYWRlci52aWV3cG9pbnQucXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBQQ0RoZWFkZXIudmlld3BvaW50LnF5LCBQQ0RoZWFkZXIudmlld3BvaW50LnF6LCBQQ0RoZWFkZXIudmlld3BvaW50LnF3KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKCB2YXIgaSA9IDAsIHJvdyA9IDA7IGkgPCBQQ0RoZWFkZXIucG9pbnRzOyBpICsrLCByb3cgKz0gUENEaGVhZGVyLnJvd1NpemUgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLnB1c2goaXRlbSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHggPSBkYXRhdmlldy5nZXRGbG9hdDMyKCByb3cgKyBvZmZzZXQueCwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeSA9IGRhdGF2aWV3LmdldEZsb2F0MzIoIHJvdyArIG9mZnNldC55LCB0cnVlICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB6ID0gZGF0YXZpZXcuZ2V0RmxvYXQzMiggcm93ICsgb2Zmc2V0LnosIHRydWUgKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcHQgPSBuZXcgVEhSRUUuVmVjdG9yMyh4LCB5LCB6KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnNlcnZlck1vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwdCA9IHB0LnN1YihjYW1Qb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHQuYXBwbHlRdWF0ZXJuaW9uKGNhbVF1YXRlcm5pb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnggPSBwdC54O1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24ucHVzaChwdC54KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS55ID0gcHQueTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uLnB1c2gocHQueSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnogPSBwdC56O1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24ucHVzaChwdC56KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBvZmZzZXQubGFiZWwgIT09IHVuZGVmaW5lZCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbGFzc0luZGV4ID0gZGF0YXZpZXcuZ2V0VWludDgoIHJvdyArIG9mZnNldC5sYWJlbCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uY2xhc3NJbmRleCA9IGNsYXNzSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWwucHVzaChjbGFzc0luZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5jbGFzc0luZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbC5wdXNoKDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIGNvbG9yc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9mZnNldC5yZ2IgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbG9yUkdCID0gZGF0YXZpZXcuZ2V0VWludDMyKHJvdyArIG9mZnNldC5yZ2IsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByID0gKGNvbG9yUkdCID4+IDE2KSAmIDB4MDAwMGZmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnID0gKGNvbG9yUkdCID4+IDgpICYgMHgwMDAwZmY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSAoY29sb3JSR0IpICYgMHgwMDAwZmY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmdiLnB1c2goW3IsIGcsIGJdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IucHVzaCgwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yLnB1c2goMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvci5wdXNoKDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYnVpbGQgZ2VvbWV0cnlcblxuICAgICAgICAgICAgICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBvc2l0aW9uLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5LnNldEF0dHJpYnV0ZSgncG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZShwb3NpdGlvbiwgMykpO1xuICAgICAgICAgICAgICAgIGlmIChsYWJlbC5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgICAgICBnZW9tZXRyeS5zZXRBdHRyaWJ1dGUoJ2xhYmVsJywgbmV3IFRIUkVFLlVpbnQ4QnVmZmVyQXR0cmlidXRlKGxhYmVsLCAzKSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbG9yLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb3JBdHQgPSBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZShjb2xvciwgMyk7XG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5LnNldEF0dHJpYnV0ZSgnY29sb3InLCBjb2xvckF0dCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnkuY29tcHV0ZUJvdW5kaW5nU3BoZXJlKCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuUG9pbnRzTWF0ZXJpYWwoe3NpemU6IDIsIGNvbG9yOiAweEU5QTk2Rn0pO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNpemVBdHRlbnVhdGlvbiA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgLy8gYnVpbGQgbWVzaFxuICAgICAgICAgICAgICAgIHZhciBtZXNoID0gbmV3IFRIUkVFLlBvaW50cyhnZW9tZXRyeSwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gdXJsLnNwbGl0KCcnKS5yZXZlcnNlKCkuam9pbignJyk7XG4gICAgICAgICAgICAgICAgbmFtZSA9IC8oW15cXC9dKikvLmV4ZWMobmFtZSk7XG4gICAgICAgICAgICAgICAgbmFtZSA9IG5hbWVbMV0uc3BsaXQoJycpLnJldmVyc2UoKS5qb2luKCcnKTtcbiAgICAgICAgICAgICAgICBtZXNoLm5hbWUgPSB1cmw7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtwb3NpdGlvbiwgbGFiZWwsIGhlYWRlcjogUENEaGVhZGVyLCByZ2J9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICB9XG59XG4iLCJcbmZ1bmN0aW9uIEZhc3RJbnRlZ2VyQ29tcHJlc3Npb24oKSB7XG59XG5cbmZ1bmN0aW9uIGJ5dGVsb2codmFsKSB7XG4gICAgaWYgKHZhbCA8ICgxIDw8IDcpKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgIH0gZWxzZSBpZiAodmFsIDwgKDEgPDwgMTQpKSB7XG4gICAgICAgIHJldHVybiAyO1xuICAgIH0gZWxzZSBpZiAodmFsIDwgKDEgPDwgMjEpKSB7XG4gICAgICAgIHJldHVybiAzO1xuICAgIH0gZWxzZSBpZiAodmFsIDwgKDEgPDwgMjgpKSB7XG4gICAgICAgIHJldHVybiA0O1xuICAgIH1cbiAgICByZXR1cm4gNTtcbn1cblxuLy8gY29tcHV0ZSBob3cgbWFueSBieXRlcyBhbiBhcnJheSBvZiBpbnRlZ2VycyB3b3VsZCB1c2Ugb25jZSBjb21wcmVzc2VkXG5GYXN0SW50ZWdlckNvbXByZXNzaW9uLmNvbXB1dGVDb21wcmVzc2VkU2l6ZUluQnl0ZXMgPSBmdW5jdGlvbihpbnB1dCkge1xuICAgIHZhciBjID0gaW5wdXQubGVuZ3RoO1xuICAgIHZhciBhbnN3ZXIgPSAwO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjOyBpKyspIHtcbiAgICAgICAgYW5zd2VyICs9IGJ5dGVsb2coaW5wdXRbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gYW5zd2VyO1xufTtcblxuXG4vLyBjb21wcmVzcyBhbiBhcnJheSBvZiBpbnRlZ2VycywgcmV0dXJuIGEgY29tcHJlc3NlZCBidWZmZXIgKGFzIGFuIEFycmF5QnVmZmVyKVxuRmFzdEludGVnZXJDb21wcmVzc2lvbi5jb21wcmVzcyA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgdmFyIGMgPSBpbnB1dC5sZW5ndGg7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcihGYXN0SW50ZWdlckNvbXByZXNzaW9uLmNvbXB1dGVDb21wcmVzc2VkU2l6ZUluQnl0ZXMoaW5wdXQpKTtcbiAgICB2YXIgdmlldyAgID0gbmV3IEludDhBcnJheShidWYpO1xuICAgIHZhciBwb3MgPSAwO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjOyBpKyspIHtcbiAgICAgICAgdmFyIHZhbCA9IGlucHV0W2ldO1xuICAgICAgICBpZiAodmFsIDwgKDEgPDwgNykpIHtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gdmFsIDtcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPCAoMSA8PCAxNCkpIHtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gKHZhbCAmIDB4N0YpIHwgMHg4MDtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gdmFsID4+PiA3O1xuICAgICAgICB9IGVsc2UgaWYgKHZhbCA8ICgxIDw8IDIxKSkge1xuICAgICAgICAgICAgdmlld1twb3MrK10gPSAodmFsICYgMHg3RikgfCAweDgwO1xuICAgICAgICAgICAgdmlld1twb3MrK10gPSAoICh2YWwgPj4+IDcpICYgMHg3RiApIHwgMHg4MDtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gdmFsID4+PiAxNDtcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPCAoMSA8PCAyOCkpIHtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gKHZhbCAmIDB4N0YgKSB8IDB4ODAgO1xuICAgICAgICAgICAgdmlld1twb3MrK10gPSAoICh2YWwgPj4+IDcpICYgMHg3RiApIHwgMHg4MDtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gKCAodmFsID4+PiAxNCkgJiAweDdGICkgfCAweDgwO1xuICAgICAgICAgICAgdmlld1twb3MrK10gPSB2YWwgPj4+IDIxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmlld1twb3MrK10gPSAoIHZhbCAmIDB4N0YgKSB8IDB4ODA7XG4gICAgICAgICAgICB2aWV3W3BvcysrXSA9ICggKHZhbCA+Pj4gNykgJiAweDdGICkgfCAweDgwO1xuICAgICAgICAgICAgdmlld1twb3MrK10gPSAoICh2YWwgPj4+IDE0KSAmIDB4N0YgKSB8IDB4ODA7XG4gICAgICAgICAgICB2aWV3W3BvcysrXSA9ICggKHZhbCA+Pj4gMjEpICYgMHg3RiApIHwgMHg4MDtcbiAgICAgICAgICAgIHZpZXdbcG9zKytdID0gdmFsID4+PiAyODtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYnVmO1xufTtcblxuLy8gZnJvbSBhIGNvbXByZXNzZWQgYXJyYXkgb2YgaW50ZWdlcnMgc3RvcmVkIEFycmF5QnVmZmVyLCBjb21wdXRlIHRoZSBudW1iZXIgb2YgY29tcHJlc3NlZCBpbnRlZ2VycyBieSBzY2FubmluZyB0aGUgaW5wdXRcbkZhc3RJbnRlZ2VyQ29tcHJlc3Npb24uY29tcHV0ZUhvd01hbnlJbnRlZ2VycyA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgdmFyIHZpZXcgICA9IG5ldyBJbnQ4QXJyYXkoaW5wdXQpO1xuICAgIHZhciBjID0gdmlldy5sZW5ndGg7XG4gICAgdmFyIGNvdW50ID0gMDtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYzsgaSsrKSB7XG4gICAgICAgIGNvdW50ICs9IChpbnB1dFtpXT4+PjcpO1xuICAgIH1cbiAgICByZXR1cm4gYyAtIGNvdW50O1xufTtcbi8vIHVuY29tcHJlc3MgYW4gYXJyYXkgb2YgaW50ZWdlciBmcm9tIGFuIEFycmF5QnVmZmVyLCByZXR1cm4gdGhlIGFycmF5XG5GYXN0SW50ZWdlckNvbXByZXNzaW9uLnVuY29tcHJlc3MgPSBmdW5jdGlvbihpbnB1dCkge1xuICAgIHZhciBhcnJheSA9IFtdO1xuICAgIHZhciBpbmJ5dGUgPSBuZXcgSW50OEFycmF5KGlucHV0KTtcbiAgICB2YXIgZW5kID0gaW5ieXRlLmxlbmd0aDtcbiAgICB2YXIgcG9zID0gMDtcblxuICAgIHdoaWxlIChlbmQgPiBwb3MpIHtcbiAgICAgICAgdmFyIGMgPSBpbmJ5dGVbcG9zKytdO1xuICAgICAgICB2YXIgdiA9IGMgJiAweDdGO1xuICAgICAgICBpZiAoYyA+PSAwKSB7XG4gICAgICAgICAgICBhcnJheS5wdXNoKHYpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgYyA9IGluYnl0ZVtwb3MrK107XG4gICAgICAgIHYgfD0gKGMgJiAweDdGKSA8PCA3O1xuICAgICAgICBpZiAoYyA+PSAwKSB7XG4gICAgICAgICAgICBhcnJheS5wdXNoKHYpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgYyA9IGluYnl0ZVtwb3MrK107XG4gICAgICAgIHYgfD0gKGMgJiAweDdGKSA8PCAxNDtcbiAgICAgICAgaWYgKGMgPj0gMCkge1xuICAgICAgICAgICAgYXJyYXkucHVzaCh2KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGMgPSBpbmJ5dGVbcG9zKytdO1xuICAgICAgICB2IHw9IChjICYgMHg3RikgPDwgMjE7XG4gICAgICAgIGlmIChjID49IDApIHtcbiAgICAgICAgICAgIGFycmF5LnB1c2godik7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjID0gaW5ieXRlW3BvcysrXTtcbiAgICAgICAgdiB8PSBjIDw8IDI4O1xuICAgICAgICBhcnJheS5wdXNoKHYpXG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbn07XG5cbkxaVyA9IHtcbiAgICBjb21wcmVzczogZnVuY3Rpb24gKHVuY29tcHJlc3NlZCkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAgICAgLy8gQnVpbGQgdGhlIGRpY3Rpb25hcnkuXG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgZGljdGlvbmFyeSA9IHt9LFxuICAgICAgICAgICAgYyxcbiAgICAgICAgICAgIHdjLFxuICAgICAgICAgICAgdyA9IFwiXCIsXG4gICAgICAgICAgICByZXN1bHQgPSBbXSxcbiAgICAgICAgICAgIGRpY3RTaXplID0gMjU2O1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMjU2OyBpICs9IDEpIHtcbiAgICAgICAgICAgIGRpY3Rpb25hcnlbU3RyaW5nLmZyb21DaGFyQ29kZShpKV0gPSBpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHVuY29tcHJlc3NlZC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgYyA9IHVuY29tcHJlc3NlZC5jaGFyQXQoaSk7XG4gICAgICAgICAgICB3YyA9IHcgKyBjO1xuICAgICAgICAgICAgLy9EbyBub3QgdXNlIGRpY3Rpb25hcnlbd2NdIGJlY2F1c2UgamF2YXNjcmlwdCBhcnJheXNcbiAgICAgICAgICAgIC8vd2lsbCByZXR1cm4gdmFsdWVzIGZvciBhcnJheVsncG9wJ10sIGFycmF5WydwdXNoJ10gZXRjXG4gICAgICAgICAgICAvLyBpZiAoZGljdGlvbmFyeVt3Y10pIHtcbiAgICAgICAgICAgIGlmIChkaWN0aW9uYXJ5Lmhhc093blByb3BlcnR5KHdjKSkge1xuICAgICAgICAgICAgICAgIHcgPSB3YztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goZGljdGlvbmFyeVt3XSk7XG4gICAgICAgICAgICAgICAgLy8gQWRkIHdjIHRvIHRoZSBkaWN0aW9uYXJ5LlxuICAgICAgICAgICAgICAgIGRpY3Rpb25hcnlbd2NdID0gZGljdFNpemUrKztcbiAgICAgICAgICAgICAgICB3ID0gU3RyaW5nKGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3V0cHV0IHRoZSBjb2RlIGZvciB3LlxuICAgICAgICBpZiAodyAhPT0gXCJcIikge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goZGljdGlvbmFyeVt3XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG5cbiAgICBkZWNvbXByZXNzOiBmdW5jdGlvbiAoY29tcHJlc3NlZCkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAgICAgLy8gQnVpbGQgdGhlIGRpY3Rpb25hcnkuXG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgZGljdGlvbmFyeSA9IFtdLFxuICAgICAgICAgICAgdyxcbiAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgIGssXG4gICAgICAgICAgICBlbnRyeSA9IFwiXCIsXG4gICAgICAgICAgICBkaWN0U2l6ZSA9IDI1NjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDI1NjsgaSArPSAxKSB7XG4gICAgICAgICAgICBkaWN0aW9uYXJ5W2ldID0gU3RyaW5nLmZyb21DaGFyQ29kZShpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHcgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvbXByZXNzZWRbMF0pO1xuICAgICAgICByZXN1bHQgPSB3O1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgY29tcHJlc3NlZC5sZW5ndGg7IGkgKz0gMSkge1xuXG4gICAgICAgICAgICBrID0gY29tcHJlc3NlZFtpXTtcbiAgICAgICAgICAgIGlmIChkaWN0aW9uYXJ5W2tdKSB7XG4gICAgICAgICAgICAgICAgZW50cnkgPSBkaWN0aW9uYXJ5W2tdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoayA9PT0gZGljdFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50cnkgPSB3ICsgdy5jaGFyQXQoMCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXN1bHQgKz0gZW50cnk7XG5cbiAgICAgICAgICAgIGRpY3Rpb25hcnlbZGljdFNpemUrK10gPSB3ICsgZW50cnkuY2hhckF0KDApO1xuXG4gICAgICAgICAgICB3ID0gZW50cnk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBvYmplY3RUb0J5dGVzKG9iail7XG4gICAgbGV0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeShvYmopO1xuICAgIHBheWxvYWQgPSBMWlcuY29tcHJlc3MocGF5bG9hZCk7XG4gICAgcGF5bG9hZCA9IEZhc3RJbnRlZ2VyQ29tcHJlc3Npb24uY29tcHJlc3MocGF5bG9hZCk7XG4gICAgcmV0dXJuIHBheWxvYWQ7XG59XG5cbmZ1bmN0aW9uIGJ5dGVzVG9PYmplY3QoYnl0ZXMpe1xuXG4gICAgaWYgKGJ5dGVzLmJ5dGVMZW5ndGggID4gMCkge1xuICAgICAgICBjb25zdCBkYXRhID0gRmFzdEludGVnZXJDb21wcmVzc2lvbi51bmNvbXByZXNzKGJ5dGVzKTtcbiAgICAgICAgY29uc3Qgc3RyID0gTFpXLmRlY29tcHJlc3MoZGF0YSk7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHN0cik7XG4gICAgfWVsc2UgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgICBjb21wcmVzczogKGRhdGEpPT4ob2JqZWN0VG9CeXRlcyhkYXRhKSksXG4gICAgdW5jb21wcmVzczogKGRhdGEpPT4oYnl0ZXNUb09iamVjdChkYXRhKSlcbn07XG4iLCJpbXBvcnQgU3NlRGF0YVdvcmtlclNlcnZlciBmcm9tIFwiLi9Tc2VEYXRhV29ya2VyU2VydmVyXCI7XG5pbXBvcnQgY29uZmlndXJhdGlvbkZpbGUgZnJvbSBcIi4vY29uZmlnXCI7XG5pbXBvcnQge2Jhc2VuYW1lfSBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHtyZWFkRmlsZX0gZnJvbSBcImZzXCI7XG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgU3NlUENETG9hZGVyIGZyb20gXCIuLi9pbXBvcnRzL2VkaXRvci8zZC9Tc2VQQ0RMb2FkZXJcIjtcblxuV2ViQXBwLmNvbm5lY3RIYW5kbGVycy51c2UoXCIvYXBpL2pzb25cIiwgZ2VuZXJhdGVKc29uKTtcbldlYkFwcC5jb25uZWN0SGFuZGxlcnMudXNlKFwiL2FwaS9wY2R0ZXh0XCIsIGdlbmVyYXRlUENET3V0cHV0LmJpbmQoe2ZpbGVNb2RlOiBmYWxzZX0pKTtcbldlYkFwcC5jb25uZWN0SGFuZGxlcnMudXNlKFwiL2FwaS9wY2RmaWxlXCIsIGdlbmVyYXRlUENET3V0cHV0LmJpbmQoe2ZpbGVNb2RlOiB0cnVlfSkpO1xuV2ViQXBwLmNvbm5lY3RIYW5kbGVycy51c2UoXCIvYXBpL2xpc3RpbmdcIiwgaW1hZ2VzTGlzdGluZyk7XG5cbmNvbnN0IHtpbWFnZXNGb2xkZXIsIHBvaW50Y2xvdWRzRm9sZGVyLCBzZXRzT2ZDbGFzc2VzTWFwfSA9IGNvbmZpZ3VyYXRpb25GaWxlO1xubmV3IFNzZVBDRExvYWRlcihUSFJFRSk7XG5cbmZ1bmN0aW9uIGltYWdlc0xpc3RpbmcocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBhbGwgPSBTc2VTYW1wbGVzLmZpbmQoe30sIHtcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgICB1cmw6IDEsXG4gICAgICAgICAgICBmb2xkZXI6IDEsXG4gICAgICAgICAgICBmaWxlOiAxLFxuICAgICAgICAgICAgdGFnczogMSxcbiAgICAgICAgICAgIGZpcnN0RWRpdERhdGU6IDEsXG4gICAgICAgICAgICBsYXN0RWRpdERhdGU6IDFcbiAgICAgICAgfVxuICAgIH0pLmZldGNoKCk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShhbGwsIG51bGwsIDEpKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVKc29uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBjb25zdCBpdGVtID0gU3NlU2FtcGxlcy5maW5kT25lKHt1cmw6IHJlcS51cmx9KTtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgICBjb25zdCBzb2MgPSBzZXRzT2ZDbGFzc2VzTWFwLmdldChpdGVtLnNvY05hbWUpO1xuICAgICAgICBpdGVtLm9iamVjdHMuZm9yRWFjaChvYmogPT4ge1xuICAgICAgICAgICAgb2JqLmxhYmVsID0gc29jLm9iamVjdHNbb2JqLmNsYXNzSW5kZXhdLmxhYmVsO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShpdGVtLCBudWxsLCAxKSk7XG4gICAgfWVsc2V7XG4gICAgICAgIHJlcy5lbmQoXCJ7fVwiKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlUENET3V0cHV0KHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgcGNkRmlsZSA9IGltYWdlc0ZvbGRlciArIGRlY29kZVVSSUNvbXBvbmVudChyZXEudXJsKTtcbiAgICBjb25zdCBmaWxlTmFtZSA9IGJhc2VuYW1lKHBjZEZpbGUpO1xuICAgIGNvbnN0IGxhYmVsRmlsZSA9IHBvaW50Y2xvdWRzRm9sZGVyICsgZGVjb2RlVVJJQ29tcG9uZW50KHJlcS51cmwpICsgXCIubGFiZWxzXCI7XG4gICAgY29uc3Qgb2JqZWN0RmlsZSA9IHBvaW50Y2xvdWRzRm9sZGVyICsgZGVjb2RlVVJJQ29tcG9uZW50KHJlcS51cmwpICsgXCIub2JqZWN0c1wiO1xuXG4gICAgaWYgKHRoaXMuZmlsZU1vZGUpIHtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1kaXNwb3NpdGlvbicsICdhdHRhY2htZW50OyBmaWxlbmFtZT1ET0MnLnJlcGxhY2UoXCJET0NcIiwgZmlsZU5hbWUpKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC10eXBlJywgJ3RleHQvcGxhaW4nKTtcbiAgICAgICAgcmVzLmNoYXJzZXQgPSAnVVRGLTgnO1xuICAgIH1cblxuXG4gICAgcmVhZEZpbGUocGNkRmlsZSwgKGVyciwgY29udGVudCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZXMuZW5kKFwiRXJyb3Igd2hpbGUgcGFyc2luZyBQQ0QgZmlsZS5cIilcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxvYWRlciA9IG5ldyBUSFJFRS5QQ0RMb2FkZXIodHJ1ZSk7XG4gICAgICAgIGNvbnN0IHBjZENvbnRlbnQgPSBsb2FkZXIucGFyc2UoY29udGVudC5idWZmZXIsIFwiXCIpO1xuICAgICAgICBjb25zdCBoYXNSZ2IgPSBwY2RDb250ZW50LnJnYi5sZW5ndGggPiAwO1xuICAgICAgICBjb25zdCBoZWFkID0gcGNkQ29udGVudC5oZWFkZXI7XG4gICAgICAgIGNvbnN0IHJnYjJpbnQgPSByZ2IgPT4gcmdiWzJdICsgMjU2ICogcmdiWzFdICsgMjU2ICogMjU2ICogcmdiWzBdO1xuXG4gICAgICAgIGxldCBvdXQgPSBcIlZFUlNJT04gLjdcXG5cIjtcbiAgICAgICAgb3V0ICs9IGhhc1JnYiA/IFwiRklFTERTIHggeSB6IHJnYiBsYWJlbCBvYmplY3RcXG5cIiA6IFwiRklFTERTIHggeSB6IGxhYmVsIG9iamVjdFxcblwiO1xuICAgICAgICBvdXQgKz0gaGFzUmdiID8gXCJTSVpFIDQgNCA0IDQgNCA0XFxuXCIgOiBcIlNJWkUgNCA0IDQgNCA0XFxuXCI7XG4gICAgICAgIG91dCArPSBoYXNSZ2IgPyBcIlRZUEUgRiBGIEYgSSBJIElcXG5cIiA6IFwiVFlQRSBGIEYgRiBJIElcXG5cIjtcbiAgICAgICAgb3V0ICs9IGhhc1JnYiA/IFwiQ09VTlQgMSAxIDEgMSAxIDFcXG5cIiA6IFwiQ09VTlQgMSAxIDEgMSAxXFxuXCI7XG4gICAgICAgIG91dCArPSBcIldJRFRIIFwiICsgcGNkQ29udGVudC5oZWFkZXIud2lkdGggKyBcIlxcblwiO1xuICAgICAgICBvdXQgKz0gXCJIRUlHSFQgXCIgKyBwY2RDb250ZW50LmhlYWRlci5oZWlnaHQgKyBcIlxcblwiO1xuICAgICAgICBvdXQgKz0gXCJQT0lOVFMgXCIgKyBwY2RDb250ZW50LmhlYWRlci53aWR0aCpwY2RDb250ZW50LmhlYWRlci5oZWlnaHQgKyBcIlxcblwiO1xuICAgICAgICBvdXQgKz0gXCJWSUVXUE9JTlQgXCIgKyBoZWFkLnZpZXdwb2ludC50eDtcbiAgICAgICAgb3V0ICs9IFwiIFwiICsgaGVhZC52aWV3cG9pbnQudHk7XG4gICAgICAgIG91dCArPSBcIiBcIiArIGhlYWQudmlld3BvaW50LnR6O1xuICAgICAgICBvdXQgKz0gXCIgXCIgKyBoZWFkLnZpZXdwb2ludC5xdztcbiAgICAgICAgb3V0ICs9IFwiIFwiICsgaGVhZC52aWV3cG9pbnQucXg7XG4gICAgICAgIG91dCArPSBcIiBcIiArIGhlYWQudmlld3BvaW50LnF5O1xuICAgICAgICBvdXQgKz0gXCIgXCIgKyBoZWFkLnZpZXdwb2ludC5xeiArIFwiXFxuXCI7XG4gICAgICAgIG91dCArPSBcIkRBVEEgYXNjaWlcXG5cIjtcbiAgICAgICAgcmVzLndyaXRlKG91dCk7XG4gICAgICAgIG91dCA9IFwiXCI7XG4gICAgICAgIHJlYWRGaWxlKGxhYmVsRmlsZSwgKGxhYmVsRXJyLCBsYWJlbENvbnRlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChsYWJlbEVycikge1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoXCJFcnJvciB3aGlsZSBwYXJzaW5nIGxhYmVscyBmaWxlLlwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbGFiZWxzID0gU3NlRGF0YVdvcmtlclNlcnZlci51bmNvbXByZXNzKGxhYmVsQ29udGVudCk7XG5cbiAgICAgICAgICAgIHJlYWRGaWxlKG9iamVjdEZpbGUsIChvYmplY3RFcnIsIG9iamVjdENvbnRlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgb2JqZWN0c0F2YWlsYWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdEVycikge1xuICAgICAgICAgICAgICAgICAgICBvYmplY3RzQXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqZWN0QnlQb2ludEluZGV4ID0gbmV3IE1hcCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdHNBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2JqZWN0cyA9IFNzZURhdGFXb3JrZXJTZXJ2ZXIudW5jb21wcmVzcyhvYmplY3RDb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0cy5mb3JFYWNoKChvYmosIG9iakluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmoucG9pbnRzLmZvckVhY2gocHRJZHggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdEJ5UG9pbnRJbmRleC5zZXQocHRJZHgsIG9iakluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsZXQgb2JqO1xuXG4gICAgICAgICAgICAgICAgcGNkQ29udGVudC5wb3NpdGlvbi5mb3JFYWNoKCh2LCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gTWF0aC5mbG9vcihpIC8gMyk7XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChpICUgMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNSZ2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0ge3JnYjogcGNkQ29udGVudC5yZ2JbcG9zaXRpb25dLCB4OiB2fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0ge3g6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmoueSA9IHY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqLnogPSB2O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dCArPSBvYmoueCArIFwiIFwiICsgb2JqLnkgKyBcIiBcIiArIG9iai56ICsgXCIgXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc1JnYikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXQgKz0gcmdiMmludChvYmoucmdiKSArIFwiIFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXQgKz0gbGFiZWxzW3Bvc2l0aW9uXSArIFwiIFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVkT2JqZWN0ID0gb2JqZWN0QnlQb2ludEluZGV4LmdldChwb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2lnbmVkT2JqZWN0ICE9IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0ICs9IGFzc2lnbmVkT2JqZWN0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0ICs9IFwiLTFcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXQgKz0gXCJcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMud3JpdGUob3V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXQgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXMuZW5kKClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuIiwiaW1wb3J0IHtNZXRlb3J9IGZyb20gXCJtZXRlb3IvbWV0ZW9yXCI7XG5pbXBvcnQge2pvaW59IGZyb20gXCJwYXRoXCI7XG5pbXBvcnQge21rZGlyU3luYywgZXhpc3RzU3luY30gZnJvbSBcImZzXCI7XG5pbXBvcnQgb3MgZnJvbSBcIm9zXCI7XG5pbXBvcnQgZG93bmxvYWQgZnJvbSBcImRvd25sb2FkXCI7XG5cbmNvbnN0IGNvbmZpZ3VyYXRpb25GaWxlID0ge307XG5jb25zdCBkZWZhdWx0Q2xhc3NlcyA9IFt7XG4gICAgXCJuYW1lXCI6IFwiMzMgQ2xhc3Nlc1wiLCBcIm9iamVjdHNcIjogW1xuICAgICAgICB7XCJsYWJlbFwiOiBcIlZPSURcIiwgXCJjb2xvclwiOiBcIiNDRkNGQ0ZcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMVwifSxcbiAgICAgICAge1wibGFiZWxcIjogXCJDbGFzcyAyXCJ9LFxuICAgICAgICB7XCJsYWJlbFwiOiBcIkNsYXNzIDNcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgNFwifSxcbiAgICAgICAge1wibGFiZWxcIjogXCJDbGFzcyA1XCJ9LFxuICAgICAgICB7XCJsYWJlbFwiOiBcIkNsYXNzIDZcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgN1wifSxcbiAgICAgICAge1wibGFiZWxcIjogXCJDbGFzcyA4XCJ9LFxuICAgICAgICB7XCJsYWJlbFwiOiBcIkNsYXNzIDlcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTBcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTFcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTJcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTNcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTRcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTVcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTZcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTdcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMThcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMTlcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjBcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjFcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjJcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjNcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjRcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjVcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjZcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjdcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjhcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMjlcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMzBcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMzFcIn0sXG4gICAgICAgIHtcImxhYmVsXCI6IFwiQ2xhc3MgMzJcIn1cbiAgICBdXG59XTtcbmNvbnN0IGluaXQgPSAoKT0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb25maWcgPSBNZXRlb3Iuc2V0dGluZ3M7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5jb25maWd1cmF0aW9uICYmIGNvbmZpZy5jb25maWd1cmF0aW9uW1wiaW1hZ2VzLWZvbGRlclwiXSAhPSBcIlwiKSB7XG4gICAgICAgICAgICBjb25maWd1cmF0aW9uRmlsZS5pbWFnZXNGb2xkZXIgPSBjb25maWcuY29uZmlndXJhdGlvbltcImltYWdlcy1mb2xkZXJcIl0ucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25GaWxlLmltYWdlc0ZvbGRlciA9IGpvaW4ob3MuaG9tZWRpcigpLCBcInNzZS1pbWFnZXNcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWV4aXN0c1N5bmMoY29uZmlndXJhdGlvbkZpbGUuaW1hZ2VzRm9sZGVyKSl7XG4gICAgICAgICAgICBta2RpclN5bmMoY29uZmlndXJhdGlvbkZpbGUuaW1hZ2VzRm9sZGVyKTtcbiAgICAgICAgICAgIGRvd25sb2FkKFwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0hpdGFjaGktQXV0b21vdGl2ZS1BbmQtSW5kdXN0cnktTGFiL3NlbWFudGljLXNlZ21lbnRhdGlvbi1lZGl0b3IvbWFzdGVyL3ByaXZhdGUvc2FtcGxlcy9iaXRtYXBfbGFiZWxpbmcucG5nXCIsIGNvbmZpZ3VyYXRpb25GaWxlLmltYWdlc0ZvbGRlcik7XG4gICAgICAgICAgICBkb3dubG9hZChcImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9IaXRhY2hpLUF1dG9tb3RpdmUtQW5kLUluZHVzdHJ5LUxhYi9zZW1hbnRpYy1zZWdtZW50YXRpb24tZWRpdG9yL21hc3Rlci9wcml2YXRlL3NhbXBsZXMvcG9pbnRjbG91ZF9sYWJlbGluZy5wY2RcIiwgY29uZmlndXJhdGlvbkZpbGUuaW1hZ2VzRm9sZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcuY29uZmlndXJhdGlvbiAmJiBjb25maWcuY29uZmlndXJhdGlvbltcImludGVybmFsLWZvbGRlclwiXSAhPSBcIlwiKSB7XG4gICAgICAgICAgICBjb25maWd1cmF0aW9uRmlsZS5wb2ludGNsb3Vkc0ZvbGRlciA9IGNvbmZpZy5jb25maWd1cmF0aW9uW1wiaW50ZXJuYWwtZm9sZGVyXCJdLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgICAgICAgfWVsc2V7XG5cbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25GaWxlLnBvaW50Y2xvdWRzRm9sZGVyID0gam9pbihvcy5ob21lZGlyKCksIFwic3NlLWludGVybmFsXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uZmlndXJhdGlvbkZpbGUuc2V0c09mQ2xhc3Nlc01hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgY29uZmlndXJhdGlvbkZpbGUuc2V0c09mQ2xhc3NlcyA9IGNvbmZpZ1tcInNldHMtb2YtY2xhc3Nlc1wiXTtcbiAgICAgICAgaWYgKCFjb25maWd1cmF0aW9uRmlsZS5zZXRzT2ZDbGFzc2VzKXtcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25GaWxlLnNldHNPZkNsYXNzZXMgPSBkZWZhdWx0Q2xhc3NlcztcbiAgICAgICAgfVxuICAgICAgICBjb25maWd1cmF0aW9uRmlsZS5zZXRzT2ZDbGFzc2VzLmZvckVhY2gobyA9PiBjb25maWd1cmF0aW9uRmlsZS5zZXRzT2ZDbGFzc2VzTWFwLnNldChvLm5hbWUsIG8pKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTZW1hbnRpYyBTZWdtZW50YXRpb24gRWRpdG9yXCIpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkltYWdlcyAoSlBHLCBQTkcsIFBDRCkgc2VydmVkIGZyb21cIiwgY29uZmlndXJhdGlvbkZpbGUuaW1hZ2VzRm9sZGVyKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJQQ0QgYmluYXJ5IHNlZ21lbnRhdGlvbiBkYXRhIHN0b3JlZCBpblwiLCBjb25maWd1cmF0aW9uRmlsZS5wb2ludGNsb3Vkc0ZvbGRlcik7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiTnVtYmVyIG9mIGF2YWlsYWJsZSBzZXRzIG9mIG9iamVjdCBjbGFzc2VzOlwiLCBjb25maWd1cmF0aW9uRmlsZS5zZXRzT2ZDbGFzc2VzLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBjb25maWd1cmF0aW9uRmlsZTtcbiAgICB9Y2F0Y2goZSl7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciB3aGlsZSBwYXJzaW5nIHNldHRpbmdzLmpzb246XCIsIGUpO1xuICAgIH1cbn07XG5leHBvcnQgZGVmYXVsdCBpbml0KCk7XG4iLCJpbXBvcnQge01ldGVvcn0gZnJvbSBcIm1ldGVvci9tZXRlb3JcIjtcbmltcG9ydCBzaGVsbCBmcm9tIFwic2hlbGxqc1wiO1xuaW1wb3J0IHNlcnZlU3RhdGljIGZyb20gXCJzZXJ2ZS1zdGF0aWNcIjtcbmltcG9ydCBib2R5UGFyc2VyIGZyb20gXCJib2R5LXBhcnNlclwiO1xuaW1wb3J0IHtjcmVhdGVXcml0ZVN0cmVhbSwgbHN0YXRTeW5jLCByZWFkZGlyU3luYywgcmVhZEZpbGUsIHJlYWRGaWxlU3luY30gZnJvbSBcImZzXCI7XG5pbXBvcnQge2Jhc2VuYW1lLCBleHRuYW1lLCBqb2lufSBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGNvbmZpZ3VyYXRpb25GaWxlIGZyb20gXCIuL2NvbmZpZ1wiO1xuY29uc3QgZGVtb01vZGUgPSBNZXRlb3Iuc2V0dGluZ3MuY29uZmlndXJhdGlvbltcImRlbW8tbW9kZVwiXTtcblxuTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuXG5jb25zdCB7aW1hZ2VzRm9sZGVyLCBwb2ludGNsb3Vkc0ZvbGRlcn0gPSBjb25maWd1cmF0aW9uRmlsZTtcbiAgICBXZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZShcIi9maWxlXCIsIHNlcnZlU3RhdGljKGltYWdlc0ZvbGRlciwge2ZhbGx0aHJvdWdoOiBmYWxzZX0pKTtcbiAgICBXZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZShcIi9kYXRhZmlsZVwiLCBzZXJ2ZVN0YXRpYyhwb2ludGNsb3Vkc0ZvbGRlciwge2ZhbGx0aHJvdWdoOiB0cnVlfSkpO1xuICAgIFdlYkFwcC5jb25uZWN0SGFuZGxlcnMudXNlKFwiL2RhdGFmaWxlXCIsIChyZXEscmVzKT0+e1xuICAgICAgICByZXMuZW5kKFwiXCIpO1xuICAgIH0pO1xuXG4gICAgV2ViQXBwLmNvbm5lY3RIYW5kbGVycy51c2UoYm9keVBhcnNlci5yYXcoe2xpbWl0OiBcIjIwMG1iXCIsIHR5cGU6ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nfSkpO1xuICAgIFdlYkFwcC5jb25uZWN0SGFuZGxlcnMudXNlKCcvc2F2ZScsIGZ1bmN0aW9uIChyZXEsIHJlcykge1xuICAgICAgICBpZiAoZGVtb01vZGUpIHJldHVybjtcbiAgICAgICAgY29uc3QgZmlsZVRvU2F2ZSA9IHBvaW50Y2xvdWRzRm9sZGVyICsgZGVjb2RlVVJJQ29tcG9uZW50KHJlcS51cmwpLnJlcGxhY2UoXCIvc2F2ZVwiLCBcIlwiKTtcbiAgICAgICAgY29uc3QgZGlyID0gZmlsZVRvU2F2ZS5tYXRjaChcIiguKlxcLykuKlwiKVsxXTtcbiAgICAgICAgc2hlbGwubWtkaXIoJy1wJywgZGlyKTtcblxuICAgICAgICB2YXIgd3N0cmVhbSA9IGNyZWF0ZVdyaXRlU3RyZWFtKGZpbGVUb1NhdmUpO1xuICAgICAgICB3c3RyZWFtLndyaXRlKHJlcS5ib2R5KTtcbiAgICAgICAgd3N0cmVhbS5lbmQoKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCIsIFwiKlwiKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIiwgXCJPcmlnaW4sIFgtUmVxdWVzdGVkLVdpdGgsIENvbnRlbnQtVHlwZSwgQWNjZXB0XCIpO1xuICAgICAgICByZXMuZW5kKFwiU2VudDogXCIgKyBmaWxlVG9TYXZlKTtcbiAgICB9KTtcbn0pO1xuIiwiaW1wb3J0IHtNZXRlb3J9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHtjcmVhdGVXcml0ZVN0cmVhbSwgbHN0YXRTeW5jLCByZWFkZGlyU3luYywgcmVhZEZpbGUsIHJlYWRGaWxlU3luYywgZXhpc3RzU3luY30gZnJvbSBcImZzXCI7XG5pbXBvcnQge2Jhc2VuYW1lLCBleHRuYW1lLCBqb2lufSBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHVybCBmcm9tIFwidXJsXCI7XG5pbXBvcnQgQ29sb3JTY2hlbWUgZnJvbSBcImNvbG9yLXNjaGVtZVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi9jb25maWdcIjtcbmNvbnN0IGRlbW9Nb2RlID0gTWV0ZW9yLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25bXCJkZW1vLW1vZGVcIl07XG5cbmxldCB7Y2xhc3Nlc30gPSBjb25maWc7XG5cbk1ldGVvci5tZXRob2RzKHtcbiAgICAnZ2V0Q2xhc3Nlc1NldHMnKCkge1xuICAgICAgICBjb25zdCBkYXRhID0gY29uZmlnLnNldHNPZkNsYXNzZXM7XG4gICAgICAgIGNvbnN0IHNjaGVtZSA9IG5ldyBDb2xvclNjaGVtZTtcbiAgICAgICAgc2NoZW1lLmZyb21faHVlKDApICAgICAgICAgLy8gU3RhcnQgdGhlIHNjaGVtZVxuICAgICAgICAgICAgLnNjaGVtZSgndGV0cmFkZScpICAgICAvLyBVc2UgdGhlICd0cmlhZGUnIHNjaGVtZSwgdGhhdCBpcywgY29sb3JzXG4gICAgICAgICAgICAvLyBzZWxlY3RlZCBmcm9tIDMgcG9pbnRzIGVxdWlkaXN0YW50IGFyb3VuZFxuICAgICAgICAgICAgLy8gdGhlIGNvbG9yIHdoZWVsLlxuICAgICAgICAgICAgLnZhcmlhdGlvbignc29mdCcpOyAgIC8vIFVzZSB0aGUgJ3NvZnQnIGNvbG9yIHZhcmlhdGlvblxuICAgICAgICBsZXQgY29sb3JzID0gc2NoZW1lLmNvbG9ycygpO1xuICAgICAgICBzY2hlbWUuZnJvbV9odWUoMTApICAgICAgICAgLy8gU3RhcnQgdGhlIHNjaGVtZVxuICAgICAgICAgICAgLnNjaGVtZSgndGV0cmFkZScpICAgICAvLyBVc2UgdGhlICd0cmlhZGUnIHNjaGVtZSwgdGhhdCBpcywgY29sb3JzXG4gICAgICAgICAgICAvLyBzZWxlY3RlZCBmcm9tIDMgcG9pbnRzIGVxdWlkaXN0YW50IGFyb3VuZFxuICAgICAgICAgICAgLy8gdGhlIGNvbG9yIHdoZWVsLlxuICAgICAgICAgICAgLnZhcmlhdGlvbigncGFzdGVsJyk7ICAgLy8gVXNlIHRoZSAnc29mdCcgY29sb3IgdmFyaWF0aW9uXG4gICAgICAgIGNvbG9ycyA9IGNvbG9ycy5jb25jYXQoc2NoZW1lLmNvbG9ycygpKTtcbiAgICAgICAgc2NoZW1lLmZyb21faHVlKDIwKSAgICAgICAgIC8vIFN0YXJ0IHRoZSBzY2hlbWVcbiAgICAgICAgICAgIC5zY2hlbWUoJ3RldHJhZGUnKSAgICAgLy8gVXNlIHRoZSAndHJpYWRlJyBzY2hlbWUsIHRoYXQgaXMsIGNvbG9yc1xuICAgICAgICAgICAgLy8gc2VsZWN0ZWQgZnJvbSAzIHBvaW50cyBlcXVpZGlzdGFudCBhcm91bmRcbiAgICAgICAgICAgIC8vIHRoZSBjb2xvciB3aGVlbC5cbiAgICAgICAgICAgIC52YXJpYXRpb24oJ2hhcmQnKTsgICAvLyBVc2UgdGhlICdzb2Z0JyBjb2xvciB2YXJpYXRpb25cbiAgICAgICAgY29sb3JzID0gY29sb3JzLmNvbmNhdChzY2hlbWUuY29sb3JzKCkpO1xuICAgICAgICBzY2hlbWUuZnJvbV9odWUoMzApICAgICAgICAgLy8gU3RhcnQgdGhlIHNjaGVtZVxuICAgICAgICAgICAgLnNjaGVtZSgndGV0cmFkZScpICAgICAvLyBVc2UgdGhlICd0cmlhZGUnIHNjaGVtZSwgdGhhdCBpcywgY29sb3JzXG4gICAgICAgICAgICAvLyBzZWxlY3RlZCBmcm9tIDMgcG9pbnRzIGVxdWlkaXN0YW50IGFyb3VuZFxuICAgICAgICAgICAgLy8gdGhlIGNvbG9yIHdoZWVsLlxuICAgICAgICAgICAgLnZhcmlhdGlvbignaGFyZCcpOyAgIC8vIFVzZSB0aGUgJ3NvZnQnIGNvbG9yIHZhcmlhdGlvblxuICAgICAgICBjb2xvcnMgPSBjb2xvcnMuY29uY2F0KHNjaGVtZS5jb2xvcnMoKSk7XG4gICAgICAgIHNjaGVtZS5mcm9tX2h1ZSg0MCkgICAgICAgICAvLyBTdGFydCB0aGUgc2NoZW1lXG4gICAgICAgICAgICAuc2NoZW1lKCd0ZXRyYWRlJykgICAgIC8vIFVzZSB0aGUgJ3RyaWFkZScgc2NoZW1lLCB0aGF0IGlzLCBjb2xvcnNcbiAgICAgICAgICAgIC8vIHNlbGVjdGVkIGZyb20gMyBwb2ludHMgZXF1aWRpc3RhbnQgYXJvdW5kXG4gICAgICAgICAgICAvLyB0aGUgY29sb3Igd2hlZWwuXG4gICAgICAgICAgICAudmFyaWF0aW9uKCdoYXJkJyk7ICAgLy8gVXNlIHRoZSAnc29mdCcgY29sb3IgdmFyaWF0aW9uXG4gICAgICAgIGNvbG9ycyA9IGNvbG9ycy5jb25jYXQoc2NoZW1lLmNvbG9ycygpKTtcbiAgICAgICAgY29sb3JzID0gY29sb3JzLm1hcChjID0+IFwiI1wiICsgYyk7XG4gICAgICAgIGRhdGEuZm9yRWFjaChzb2MgPT4ge1xuICAgICAgICAgICAgc29jLm9iamVjdHMuZm9yRWFjaCgob2MsIGkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIW9jLmNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIG9jLmNvbG9yID0gY29sb3JzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuICAgIC8qXG4gICAgICAgICdyZWJ1aWxkVGFnTGlzdCcoKSB7XG4gICAgICAgICAgICBjb25zdCBhbGwgPSBTc2VTYW1wbGVzLmZpbmQoKS5mZXRjaCgpO1xuICAgICAgICAgICAgY29uc3QgdGFncyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICAgIGFsbC5mb3JFYWNoKHMgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChzLnRhZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcy50YWdzLmZvckVhY2godCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YWdzLmFkZCh0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgU3NlUHJvcHMucmVtb3ZlKHt9KTtcbiAgICAgICAgICAgIFNzZVByb3BzLnVwc2VydCh7a2V5OiBcInRhZ3NcIn0sIHtrZXk6IFwidGFnc1wiLCB2YWx1ZTogQXJyYXkuZnJvbSh0YWdzKX0pO1xuICAgICAgICB9LFxuICAgICovXG4gICAgJ2ltYWdlcycoZm9sZGVyLCBwYWdlSW5kZXgsIHBhZ2VMZW5ndGgpIHtcbiAgICAgICAgY29uc3QgaXNEaXJlY3RvcnkgPSBzb3VyY2UgPT4gbHN0YXRTeW5jKHNvdXJjZSkuaXNEaXJlY3RvcnkoKTtcbiAgICAgICAgY29uc3QgaXNJbWFnZSA9IHNvdXJjZSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdGF0ID0gbHN0YXRTeW5jKHNvdXJjZSk7XG4gICAgICAgICAgICByZXR1cm4gKHN0YXQuaXNGaWxlKCkgfHwgc3RhdC5pc1N5bWJvbGljTGluaygpKSAmJlxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgZXh0bmFtZShzb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT0gXCIuYm1wXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgZXh0bmFtZShzb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT0gXCIuanBlZ1wiIHx8XG4gICAgICAgICAgICAgICAgICAgIGV4dG5hbWUoc291cmNlKS50b0xvd2VyQ2FzZSgpID09IFwiLmpwZ1wiIHx8XG4gICAgICAgICAgICAgICAgICAgIGV4dG5hbWUoc291cmNlKS50b0xvd2VyQ2FzZSgpID09IFwiLnBjZFwiIHx8XG4gICAgICAgICAgICAgICAgICAgIGV4dG5hbWUoc291cmNlKS50b0xvd2VyQ2FzZSgpID09IFwiLnBuZ1wiXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBnZXREaXJlY3RvcmllcyA9IHNvdXJjZSA9PlxuICAgICAgICAgICAgcmVhZGRpclN5bmMoc291cmNlKS5tYXAobmFtZSA9PiBqb2luKHNvdXJjZSwgbmFtZSkpLmZpbHRlcihpc0RpcmVjdG9yeSkubWFwKGEgPT4gYmFzZW5hbWUoYSkpO1xuXG4gICAgICAgIGNvbnN0IGdldEltYWdlcyA9IHNvdXJjZSA9PlxuICAgICAgICAgICAgcmVhZGRpclN5bmMoc291cmNlKS5tYXAobmFtZSA9PiBqb2luKHNvdXJjZSwgbmFtZSkpLmZpbHRlcihpc0ltYWdlKTtcblxuICAgICAgICBjb25zdCBnZXRJbWFnZURlc2MgPSBwYXRoID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbmFtZTogYmFzZW5hbWUocGF0aCksXG4gICAgICAgICAgICAgICAgZWRpdFVybDogXCIvZWRpdC9cIiArIGVuY29kZVVSSUNvbXBvbmVudChmb2xkZXJTbGFzaCArIGJhc2VuYW1lKHBhdGgpKSxcbiAgICAgICAgICAgICAgICB1cmw6IChmb2xkZXJTbGFzaCA/IFwiL1wiICsgZm9sZGVyU2xhc2ggOiBcIlwiKSArIFwiXCIgKyBiYXNlbmFtZShwYXRoKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBnZXRGb2xkZXJEZXNjID0gKHBhdGgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbmFtZTogYmFzZW5hbWUocGF0aCksXG4gICAgICAgICAgICAgICAgdXJsOiBgL2Jyb3dzZS8ke3BhZ2VJbmRleH0vJHtwYWdlTGVuZ3RofS9gICsgZW5jb2RlVVJJQ29tcG9uZW50KGZvbGRlclNsYXNoICsgcGF0aClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBwYWdlSW5kZXggPSBwYXJzZUludChwYWdlSW5kZXgpO1xuICAgICAgICBwYWdlTGVuZ3RoID0gcGFyc2VJbnQocGFnZUxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGZvbGRlclNsYXNoID0gZm9sZGVyID8gZGVjb2RlVVJJQ29tcG9uZW50KGZvbGRlcikgKyBcIi9cIiA6IFwiL1wiO1xuICAgICAgICBjb25zdCBsZWFmID0gam9pbihjb25maWcuaW1hZ2VzRm9sZGVyLCAoZm9sZGVyU2xhc2ggPyBmb2xkZXJTbGFzaCA6IFwiXCIpKTtcblxuICAgICAgICBjb25zdCBleGlzdGluZyA9IGV4aXN0c1N5bmMobGVhZik7XG5cbiAgICAgICAgaWYgKGV4aXN0aW5nICYmICFpc0RpcmVjdG9yeShsZWFmKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtlcnJvcjogbGVhZiArIFwiIGlzIGEgZmlsZSBidXQgc2hvdWxkIGJlIGEgZm9sZGVyLiBDaGVjayB0aGUgZG9jdW1lbnRhdGlvbiBhbmQgeW91ciBzZXR0aW5ncy5qc29uXCJ9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB7ZXJyb3I6IGxlYWYgKyBcIiBkb2VzIG5vdCBleGlzdHMuIENoZWNrIHRoZSBkb2N1bWVudGF0aW9uIGFuZCB5b3VyIHNldHRpbmdzLmpzb25cIn07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkaXJzID0gZ2V0RGlyZWN0b3JpZXMobGVhZik7XG4gICAgICAgIGNvbnN0IGltYWdlcyA9IGdldEltYWdlcyhsZWFmKTtcbiAgICAgICAgY29uc3QgcmVzID0ge1xuICAgICAgICAgICAgZm9sZGVyczogZGlycy5tYXAoZ2V0Rm9sZGVyRGVzYyksXG4gICAgICAgICAgICBpbWFnZXM6IGltYWdlcy5tYXAoZ2V0SW1hZ2VEZXNjKS5zbGljZShwYWdlSW5kZXggKiBwYWdlTGVuZ3RoLCBwYWdlSW5kZXggKiBwYWdlTGVuZ3RoICsgcGFnZUxlbmd0aCksXG4gICAgICAgICAgICBpbWFnZXNDb3VudDogaW1hZ2VzLmxlbmd0aFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChwYWdlSW5kZXggKiBwYWdlTGVuZ3RoICsgcGFnZUxlbmd0aCA8IGltYWdlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlcy5uZXh0UGFnZSA9IGAvYnJvd3NlLyR7cGFnZUluZGV4ICsgMX0vJHtwYWdlTGVuZ3RofS9gICsgKGZvbGRlciA/IGVuY29kZVVSSUNvbXBvbmVudChmb2xkZXIpIDogXCJcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhZ2VJbmRleCA+IDApIHtcbiAgICAgICAgICAgIHJlcy5wcmV2aW91c1BhZ2UgPSBgL2Jyb3dzZS8ke3BhZ2VJbmRleCAtIDF9LyR7cGFnZUxlbmd0aH0vYCArIChmb2xkZXIgPyBlbmNvZGVVUklDb21wb25lbnQoZm9sZGVyKSA6IFwiXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuXG4gICAgJ3NhdmVEYXRhJyhzYW1wbGUpIHtcbiAgICAgICAgaWYgKGRlbW9Nb2RlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGF0dHJzID0gdXJsLnBhcnNlKHNhbXBsZS51cmwpO1xuICAgICAgICBsZXQgcGF0aCA9IGRlY29kZVVSSUNvbXBvbmVudChhdHRycy5wYXRobmFtZSk7XG4gICAgICAgIHNhbXBsZS5mb2xkZXIgPSBwYXRoLnN1YnN0cmluZygxLCBwYXRoLmxhc3RJbmRleE9mKFwiL1wiKSk7XG4gICAgICAgIHNhbXBsZS5maWxlID0gcGF0aC5zdWJzdHJpbmcocGF0aC5sYXN0SW5kZXhPZihcIi9cIikgKyAxKTtcbiAgICAgICAgc2FtcGxlLmxhc3RFZGl0RGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIGlmICghc2FtcGxlLmZpcnN0RWRpdERhdGUpXG4gICAgICAgICAgICBzYW1wbGUuZmlyc3RFZGl0RGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIGlmIChzYW1wbGUudGFncykge1xuICAgICAgICAgICAgU3NlUHJvcHMudXBzZXJ0KHtrZXk6IFwidGFnc1wifSwgeyRhZGRUb1NldDoge3ZhbHVlOiB7JGVhY2g6IHNhbXBsZS50YWdzfX19KTtcbiAgICAgICAgfVxuICAgICAgICBTc2VTYW1wbGVzLnVwc2VydCh7dXJsOiBzYW1wbGUudXJsfSwgc2FtcGxlKTtcbiAgICB9XG59KTtcbiJdfQ==
