(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/server/server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("../common/namespace.js", {
  DDP: "DDP"
}, 0);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/MethodInvoker.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => MethodInvoker
});

class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;

    this._onResultReceived = options.onResultReceived || (() => {});

    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false; // Register with the connection.

    this._connection._methodInvokers[this.methodId] = this;
  } // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.


  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result'); // If we're re-sending it, it doesn't matter if data was written the first
    // time.

    this._dataVisible = false;
    this.sentMessage = true; // If this is a wait method, make all data messages be buffered until it is
    // done.

    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true; // Actually send the message.

    this._connection._send(this._message);
  } // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.


  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]); // Forget about this method.


      delete this._connection._methodInvokers[this.methodId]; // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.

      this._connection._outstandingMethodFinished();
    }
  } // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.


  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];

    this._onResultReceived(err, result);

    this._maybeInvokeCallback();
  } // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.


  dataVisible() {
    this._dataVisible = true;

    this._maybeInvokeCallback();
  } // True if receiveResult has been called.


  gotResult() {
    return !!this._methodResult;
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/livedata_connection.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  Connection: () => Connection
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }

}, 1);
let Tracker;
module.link("meteor/tracker", {
  Tracker(v) {
    Tracker = v;
  }

}, 2);
let EJSON;
module.link("meteor/ejson", {
  EJSON(v) {
    EJSON = v;
  }

}, 3);
let Random;
module.link("meteor/random", {
  Random(v) {
    Random = v;
  }

}, 4);
let Hook;
module.link("meteor/callback-hook", {
  Hook(v) {
    Hook = v;
  }

}, 5);
let MongoID;
module.link("meteor/mongo-id", {
  MongoID(v) {
    MongoID = v;
  }

}, 6);
let DDP;
module.link("./namespace.js", {
  DDP(v) {
    DDP = v;
  }

}, 7);
let MethodInvoker;
module.link("./MethodInvoker.js", {
  default(v) {
    MethodInvoker = v;
  }

}, 8);
let hasOwn, slice, keys, isEmpty, last;
module.link("meteor/ddp-common/utils.js", {
  hasOwn(v) {
    hasOwn = v;
  },

  slice(v) {
    slice = v;
  },

  keys(v) {
    keys = v;
  },

  isEmpty(v) {
    isEmpty = v;
  },

  last(v) {
    last = v;
  }

}, 9);

if (Meteor.isServer) {
  var Fiber = Npm.require('fibers');

  var Future = Npm.require('fibers/future');
}

class MongoIDMap extends IdMap {
  constructor() {
    super(MongoID.idStringify, MongoID.idParse);
  }

} // @param url {String|Object} URL to Meteor app,
//   or an object as a test hook (see code)
// Options:
//   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
//   headers: extra headers to send on the websockets connection, for
//     server-to-server DDP only
//   _sockjsOptions: Specifies options to pass through to the sockjs client
//   onDDPNegotiationVersionFailure: callback when version negotiation fails.
//
// XXX There should be a way to destroy a DDP connection, causing all
// outstanding method calls to fail.
//
// XXX Our current way of handling failure and reconnection is great
// for an app (where we want to tolerate being disconnected as an
// expect state, and keep trying forever to reconnect) but cumbersome
// for something like a command line tool that wants to make a
// connection, call a method, and print an error if connection
// fails. We should have better usability in the latter case (while
// still transparently reconnecting if it's just a transient failure
// or the server migrating us).


class Connection {
  constructor(url, options) {
    var self = this;
    this.options = options = _objectSpread({
      onConnected() {},

      onDDPVersionNegotiationFailure(description) {
        Meteor._debug(description);
      },

      heartbeatInterval: 17500,
      heartbeatTimeout: 15000,
      npmFayeOptions: Object.create(null),
      // These options are only for testing.
      reloadWithOutstanding: false,
      supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
      retry: true,
      respondToPings: true,
      // When updates are coming within this ms interval, batch them together.
      bufferedWritesInterval: 5,
      // Flush buffers immediately if writes are happening continuously for more than this many ms.
      bufferedWritesMaxAge: 500
    }, options); // If set, called when we reconnect, queuing method calls _before_ the
    // existing outstanding ones.
    // NOTE: This feature has been preserved for backwards compatibility. The
    // preferred method of setting a callback on reconnect is to use
    // DDP.onReconnect.

    self.onReconnect = null; // as a test hook, allow passing a stream instead of a url.

    if (typeof url === 'object') {
      self._stream = url;
    } else {
      const {
        ClientStream
      } = require("meteor/socket-stream-client");

      self._stream = new ClientStream(url, {
        retry: options.retry,
        ConnectionError: DDP.ConnectionError,
        headers: options.headers,
        _sockjsOptions: options._sockjsOptions,
        // Used to keep some tests quiet, or for other cases in which
        // the right thing to do with connection errors is to silently
        // fail (e.g. sending package usage stats). At some point we
        // should have a real API for handling client-stream-level
        // errors.
        _dontPrintErrors: options._dontPrintErrors,
        connectTimeoutMs: options.connectTimeoutMs,
        npmFayeOptions: options.npmFayeOptions
      });
    }

    self._lastSessionId = null;
    self._versionSuggestion = null; // The last proposed DDP version.

    self._version = null; // The DDP version agreed on by client and server.

    self._stores = Object.create(null); // name -> object with methods

    self._methodHandlers = Object.create(null); // name -> func

    self._nextMethodId = 1;
    self._supportedDDPVersions = options.supportedDDPVersions;
    self._heartbeatInterval = options.heartbeatInterval;
    self._heartbeatTimeout = options.heartbeatTimeout; // Tracks methods which the user has tried to call but which have not yet
    // called their user callback (ie, they are waiting on their result or for all
    // of their writes to be written to the local cache). Map from method ID to
    // MethodInvoker object.

    self._methodInvokers = Object.create(null); // Tracks methods which the user has called but whose result messages have not
    // arrived yet.
    //
    // _outstandingMethodBlocks is an array of blocks of methods. Each block
    // represents a set of methods that can run at the same time. The first block
    // represents the methods which are currently in flight; subsequent blocks
    // must wait for previous blocks to be fully finished before they can be sent
    // to the server.
    //
    // Each block is an object with the following fields:
    // - methods: a list of MethodInvoker objects
    // - wait: a boolean; if true, this block had a single method invoked with
    //         the "wait" option
    //
    // There will never be adjacent blocks with wait=false, because the only thing
    // that makes methods need to be serialized is a wait method.
    //
    // Methods are removed from the first block when their "result" is
    // received. The entire first block is only removed when all of the in-flight
    // methods have received their results (so the "methods" list is empty) *AND*
    // all of the data written by those methods are visible in the local cache. So
    // it is possible for the first block's methods list to be empty, if we are
    // still waiting for some objects to quiesce.
    //
    // Example:
    //  _outstandingMethodBlocks = [
    //    {wait: false, methods: []},
    //    {wait: true, methods: [<MethodInvoker for 'login'>]},
    //    {wait: false, methods: [<MethodInvoker for 'foo'>,
    //                            <MethodInvoker for 'bar'>]}]
    // This means that there were some methods which were sent to the server and
    // which have returned their results, but some of the data written by
    // the methods may not be visible in the local cache. Once all that data is
    // visible, we will send a 'login' method. Once the login method has returned
    // and all the data is visible (including re-running subs if userId changes),
    // we will send the 'foo' and 'bar' methods in parallel.

    self._outstandingMethodBlocks = []; // method ID -> array of objects with keys 'collection' and 'id', listing
    // documents written by a given method's stub. keys are associated with
    // methods whose stub wrote at least one document, and whose data-done message
    // has not yet been received.

    self._documentsWrittenByStub = Object.create(null); // collection -> IdMap of "server document" object. A "server document" has:
    // - "document": the version of the document according the
    //   server (ie, the snapshot before a stub wrote it, amended by any changes
    //   received from the server)
    //   It is undefined if we think the document does not exist
    // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
    //   whose "data done" messages have not yet been processed

    self._serverDocuments = Object.create(null); // Array of callbacks to be called after the next update of the local
    // cache. Used for:
    //  - Calling methodInvoker.dataVisible and sub ready callbacks after
    //    the relevant data is flushed.
    //  - Invoking the callbacks of "half-finished" methods after reconnect
    //    quiescence. Specifically, methods whose result was received over the old
    //    connection (so we don't re-send it) but whose data had not been made
    //    visible.

    self._afterUpdateCallbacks = []; // In two contexts, we buffer all incoming data messages and then process them
    // all at once in a single update:
    //   - During reconnect, we buffer all data messages until all subs that had
    //     been ready before reconnect are ready again, and all methods that are
    //     active have returned their "data done message"; then
    //   - During the execution of a "wait" method, we buffer all data messages
    //     until the wait method gets its "data done" message. (If the wait method
    //     occurs during reconnect, it doesn't get any special handling.)
    // all data messages are processed in one update.
    //
    // The following fields are used for this "quiescence" process.
    // This buffers the messages that aren't being processed yet.

    self._messagesBufferedUntilQuiescence = []; // Map from method ID -> true. Methods are removed from this when their
    // "data done" message is received, and we will not quiesce until it is
    // empty.

    self._methodsBlockingQuiescence = Object.create(null); // map from sub ID -> true for subs that were ready (ie, called the sub
    // ready callback) before reconnect but haven't become ready again yet

    self._subsBeingRevived = Object.create(null); // map from sub._id -> true
    // if true, the next data update should reset all stores. (set during
    // reconnect.)

    self._resetStores = false; // name -> array of updates for (yet to be created) collections

    self._updatesForUnknownStores = Object.create(null); // if we're blocking a migration, the retry func

    self._retryMigrate = null;
    self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self); // Collection name -> array of messages.

    self._bufferedWrites = Object.create(null); // When current buffer of updates must be flushed at, in ms timestamp.

    self._bufferedWritesFlushAt = null; // Timeout handle for the next processing of all pending writes

    self._bufferedWritesFlushHandle = null;
    self._bufferedWritesInterval = options.bufferedWritesInterval;
    self._bufferedWritesMaxAge = options.bufferedWritesMaxAge; // metadata for subscriptions.  Map from sub ID to object with keys:
    //   - id
    //   - name
    //   - params
    //   - inactive (if true, will be cleaned up if not reused in re-run)
    //   - ready (has the 'ready' message been received?)
    //   - readyCallback (an optional callback to call when ready)
    //   - errorCallback (an optional callback to call if the sub terminates with
    //                    an error, XXX COMPAT WITH 1.0.3.1)
    //   - stopCallback (an optional callback to call when the sub terminates
    //     for any reason, with an error argument if an error triggered the stop)

    self._subscriptions = Object.create(null); // Reactive userId.

    self._userId = null;
    self._userIdDeps = new Tracker.Dependency(); // Block auto-reload while we're waiting for method responses.

    if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
      Package.reload.Reload._onMigrate(retry => {
        if (!self._readyToMigrate()) {
          if (self._retryMigrate) throw new Error('Two migrations in progress?');
          self._retryMigrate = retry;
          return false;
        } else {
          return [true];
        }
      });
    }

    var onDisconnect = () => {
      if (self._heartbeat) {
        self._heartbeat.stop();

        self._heartbeat = null;
      }
    };

    if (Meteor.isServer) {
      self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));

      self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));

      self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
    } else {
      self._stream.on('message', this.onMessage.bind(this));

      self._stream.on('reset', this.onReset.bind(this));

      self._stream.on('disconnect', onDisconnect);
    }
  } // 'name' is the name of the data on the wire that should go in the
  // store. 'wrappedStore' should be an object with methods beginUpdate, update,
  // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.


  registerStore(name, wrappedStore) {
    var self = this;
    if (name in self._stores) return false; // Wrap the input object in an object which makes any store method not
    // implemented by 'store' into a no-op.

    var store = Object.create(null);
    ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'].forEach(method => {
      store[method] = function () {
        if (wrappedStore[method]) {
          return wrappedStore[method](...arguments);
        }
      };
    });
    self._stores[name] = store;
    var queued = self._updatesForUnknownStores[name];

    if (queued) {
      store.beginUpdate(queued.length, false);
      queued.forEach(msg => {
        store.update(msg);
      });
      store.endUpdate();
      delete self._updatesForUnknownStores[name];
    }

    return true;
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.subscribe
   * @summary Subscribe to a record set.  Returns a handle that provides
   * `stop()` and `ready()` methods.
   * @locus Client
   * @param {String} name Name of the subscription.  Matches the name of the
   * server's `publish()` call.
   * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
   * function on server.
   * @param {Function|Object} [callbacks] Optional. May include `onStop`
   * and `onReady` callbacks. If there is an error, it is passed as an
   * argument to `onStop`. If a function is passed instead of an object, it
   * is interpreted as an `onReady` callback.
   */


  subscribe(name
  /* .. [arguments] .. (callback|callbacks) */
  ) {
    var self = this;
    var params = slice.call(arguments, 1);
    var callbacks = Object.create(null);

    if (params.length) {
      var lastParam = params[params.length - 1];

      if (typeof lastParam === 'function') {
        callbacks.onReady = params.pop();
      } else if (lastParam && [lastParam.onReady, // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
      // onStop with an error callback instead.
      lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
        callbacks = params.pop();
      }
    } // Is there an existing sub with the same name and param, run in an
    // invalidated Computation? This will happen if we are rerunning an
    // existing computation.
    //
    // For example, consider a rerun of:
    //
    //     Tracker.autorun(function () {
    //       Meteor.subscribe("foo", Session.get("foo"));
    //       Meteor.subscribe("bar", Session.get("bar"));
    //     });
    //
    // If "foo" has changed but "bar" has not, we will match the "bar"
    // subcribe to an existing inactive subscription in order to not
    // unsub and resub the subscription unnecessarily.
    //
    // We only look for one such sub; if there are N apparently-identical subs
    // being invalidated, we will require N matching subscribe calls to keep
    // them all active.


    var existing;
    keys(self._subscriptions).some(id => {
      const sub = self._subscriptions[id];

      if (sub.inactive && sub.name === name && EJSON.equals(sub.params, params)) {
        return existing = sub;
      }
    });
    var id;

    if (existing) {
      id = existing.id;
      existing.inactive = false; // reactivate

      if (callbacks.onReady) {
        // If the sub is not already ready, replace any ready callback with the
        // one provided now. (It's not really clear what users would expect for
        // an onReady callback inside an autorun; the semantics we provide is
        // that at the time the sub first becomes ready, we call the last
        // onReady callback provided, if any.)
        // If the sub is already ready, run the ready callback right away.
        // It seems that users would expect an onReady callback inside an
        // autorun to trigger once the the sub first becomes ready and also
        // when re-subs happens.
        if (existing.ready) {
          callbacks.onReady();
        } else {
          existing.readyCallback = callbacks.onReady;
        }
      } // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
      // onStop with an optional error argument


      if (callbacks.onError) {
        // Replace existing callback if any, so that errors aren't
        // double-reported.
        existing.errorCallback = callbacks.onError;
      }

      if (callbacks.onStop) {
        existing.stopCallback = callbacks.onStop;
      }
    } else {
      // New sub! Generate an id, save it locally, and send message.
      id = Random.id();
      self._subscriptions[id] = {
        id: id,
        name: name,
        params: EJSON.clone(params),
        inactive: false,
        ready: false,
        readyDeps: new Tracker.Dependency(),
        readyCallback: callbacks.onReady,
        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        errorCallback: callbacks.onError,
        stopCallback: callbacks.onStop,
        connection: self,

        remove() {
          delete this.connection._subscriptions[this.id];
          this.ready && this.readyDeps.changed();
        },

        stop() {
          this.connection._send({
            msg: 'unsub',
            id: id
          });

          this.remove();

          if (callbacks.onStop) {
            callbacks.onStop();
          }
        }

      };

      self._send({
        msg: 'sub',
        id: id,
        name: name,
        params: params
      });
    } // return a handle to the application.


    var handle = {
      stop() {
        if (!hasOwn.call(self._subscriptions, id)) {
          return;
        }

        self._subscriptions[id].stop();
      },

      ready() {
        // return false if we've unsubscribed.
        if (!hasOwn.call(self._subscriptions, id)) {
          return false;
        }

        var record = self._subscriptions[id];
        record.readyDeps.depend();
        return record.ready;
      },

      subscriptionId: id
    };

    if (Tracker.active) {
      // We're in a reactive computation, so we'd like to unsubscribe when the
      // computation is invalidated... but not if the rerun just re-subscribes
      // to the same subscription!  When a rerun happens, we use onInvalidate
      // as a change to mark the subscription "inactive" so that it can
      // be reused from the rerun.  If it isn't reused, it's killed from
      // an afterFlush.
      Tracker.onInvalidate(c => {
        if (hasOwn.call(self._subscriptions, id)) {
          self._subscriptions[id].inactive = true;
        }

        Tracker.afterFlush(() => {
          if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
            handle.stop();
          }
        });
      });
    }

    return handle;
  } // options:
  // - onLateError {Function(error)} called if an error was received after the ready event.
  //     (errors received before ready cause an error to be thrown)


  _subscribeAndWait(name, args, options) {
    var self = this;
    var f = new Future();
    var ready = false;
    var handle;
    args = args || [];
    args.push({
      onReady() {
        ready = true;
        f['return']();
      },

      onError(e) {
        if (!ready) f['throw'](e);else options && options.onLateError && options.onLateError(e);
      }

    });
    handle = self.subscribe.apply(self, [name].concat(args));
    f.wait();
    return handle;
  }

  methods(methods) {
    keys(methods).forEach(name => {
      const func = methods[name];

      if (typeof func !== 'function') {
        throw new Error("Method '" + name + "' must be a function");
      }

      if (this._methodHandlers[name]) {
        throw new Error("A method named '" + name + "' is already defined");
      }

      this._methodHandlers[name] = func;
    });
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.call
   * @summary Invokes a method passing any number of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable} [arg1,arg2...] Optional method arguments
   * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
   */


  call(name
  /* .. [arguments] .. callback */
  ) {
    // if it's a function, the last argument is the result callback,
    // not a parameter to the remote method.
    var args = slice.call(arguments, 1);
    if (args.length && typeof args[args.length - 1] === 'function') var callback = args.pop();
    return this.apply(name, args, callback);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.apply
   * @summary Invoke a method passing an array of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable[]} args Method arguments
   * @param {Object} [options]
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
   * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
   * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
   * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
   */


  apply(name, args, options, callback) {
    var self = this; // We were passed 3 arguments. They may be either (name, args, options)
    // or (name, args, callback)

    if (!callback && typeof options === 'function') {
      callback = options;
      options = Object.create(null);
    }

    options = options || Object.create(null);

    if (callback) {
      // XXX would it be better form to do the binding in stream.on,
      // or caller, instead of here?
      // XXX improve error message (and how we report it)
      callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
    } // Keep our args safe from mutation (eg if we don't send the message for a
    // while because of a wait method).


    args = EJSON.clone(args);

    var enclosing = DDP._CurrentMethodInvocation.get();

    var alreadyInSimulation = enclosing && enclosing.isSimulation; // Lazily generate a randomSeed, only if it is requested by the stub.
    // The random streams only have utility if they're used on both the client
    // and the server; if the client doesn't generate any 'random' values
    // then we don't expect the server to generate any either.
    // Less commonly, the server may perform different actions from the client,
    // and may in fact generate values where the client did not, but we don't
    // have any client-side values to match, so even here we may as well just
    // use a random seed on the server.  In that case, we don't pass the
    // randomSeed to save bandwidth, and we don't even generate it to save a
    // bit of CPU and to avoid consuming entropy.

    var randomSeed = null;

    var randomSeedGenerator = () => {
      if (randomSeed === null) {
        randomSeed = DDPCommon.makeRpcSeed(enclosing, name);
      }

      return randomSeed;
    }; // Run the stub, if we have one. The stub is supposed to make some
    // temporary writes to the database to give the user a smooth experience
    // until the actual result of executing the method comes back from the
    // server (whereupon the temporary writes to the database will be reversed
    // during the beginUpdate/endUpdate process.)
    //
    // Normally, we ignore the return value of the stub (even if it is an
    // exception), in favor of the real return value from the server. The
    // exception is if the *caller* is a stub. In that case, we're not going
    // to do a RPC, so we use the return value of the stub as our return
    // value.


    var stub = self._methodHandlers[name];

    if (stub) {
      var setUserId = userId => {
        self.setUserId(userId);
      };

      var invocation = new DDPCommon.MethodInvocation({
        isSimulation: true,
        userId: self.userId(),
        setUserId: setUserId,

        randomSeed() {
          return randomSeedGenerator();
        }

      });
      if (!alreadyInSimulation) self._saveOriginals();

      try {
        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        var stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        });
      } catch (e) {
        var exception = e;
      }
    } // If we're in a simulation, stop and return the result we have,
    // rather than going on to do an RPC. If there was no stub,
    // we'll end up returning undefined.


    if (alreadyInSimulation) {
      if (callback) {
        callback(exception, stubReturnValue);
        return undefined;
      }

      if (exception) throw exception;
      return stubReturnValue;
    } // We only create the methodId here because we don't actually need one if
    // we're already in a simulation


    const methodId = '' + self._nextMethodId++;

    if (stub) {
      self._retrieveAndStoreOriginals(methodId);
    } // Generate the DDP message for the method call. Note that on the client,
    // it is important that the stub have finished before we send the RPC, so
    // that we know we have a complete list of which local documents the stub
    // wrote.


    var message = {
      msg: 'method',
      method: name,
      params: args,
      id: methodId
    }; // If an exception occurred in a stub, and we're ignoring it
    // because we're doing an RPC and want to use what the server
    // returns instead, log it so the developer knows
    // (unless they explicitly ask to see the error).
    //
    // Tests can set the '_expectedByTest' flag on an exception so it won't
    // go to log.

    if (exception) {
      if (options.throwStubExceptions) {
        throw exception;
      } else if (!exception._expectedByTest) {
        Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
      }
    } // At this point we're definitely doing an RPC, and we're going to
    // return the value of the RPC to the caller.
    // If the caller didn't give a callback, decide what to do.


    if (!callback) {
      if (Meteor.isClient) {
        // On the client, we don't have fibers, so we can't block. The
        // only thing we can do is to return undefined and discard the
        // result of the RPC. If an error occurred then print the error
        // to the console.
        callback = err => {
          err && Meteor._debug("Error invoking Method '" + name + "'", err);
        };
      } else {
        // On the server, make the function synchronous. Throw on
        // errors, return on success.
        var future = new Future();
        callback = future.resolver();
      }
    } // Send the randomSeed only if we used it


    if (randomSeed !== null) {
      message.randomSeed = randomSeed;
    }

    var methodInvoker = new MethodInvoker({
      methodId,
      callback: callback,
      connection: self,
      onResultReceived: options.onResultReceived,
      wait: !!options.wait,
      message: message,
      noRetry: !!options.noRetry
    });

    if (options.wait) {
      // It's a wait method! Wait methods go in their own block.
      self._outstandingMethodBlocks.push({
        wait: true,
        methods: [methodInvoker]
      });
    } else {
      // Not a wait method. Start a new block if the previous block was a wait
      // block, and add it to the last block of methods.
      if (isEmpty(self._outstandingMethodBlocks) || last(self._outstandingMethodBlocks).wait) {
        self._outstandingMethodBlocks.push({
          wait: false,
          methods: []
        });
      }

      last(self._outstandingMethodBlocks).methods.push(methodInvoker);
    } // If we added it to the first block, send it out now.


    if (self._outstandingMethodBlocks.length === 1) methodInvoker.sendMessage(); // If we're using the default callback on the server,
    // block waiting for the result.

    if (future) {
      return future.wait();
    }

    return options.returnStubValue ? stubReturnValue : undefined;
  } // Before calling a method stub, prepare all stores to track changes and allow
  // _retrieveAndStoreOriginals to get the original versions of changed
  // documents.


  _saveOriginals() {
    if (!this._waitingForQuiescence()) {
      this._flushBufferedWrites();
    }

    keys(this._stores).forEach(storeName => {
      this._stores[storeName].saveOriginals();
    });
  } // Retrieves the original versions of all documents modified by the stub for
  // method 'methodId' from all stores and saves them to _serverDocuments (keyed
  // by document) and _documentsWrittenByStub (keyed by method ID).


  _retrieveAndStoreOriginals(methodId) {
    var self = this;
    if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
    var docsWritten = [];
    keys(self._stores).forEach(collection => {
      var originals = self._stores[collection].retrieveOriginals(); // not all stores define retrieveOriginals


      if (!originals) return;
      originals.forEach((doc, id) => {
        docsWritten.push({
          collection,
          id
        });

        if (!hasOwn.call(self._serverDocuments, collection)) {
          self._serverDocuments[collection] = new MongoIDMap();
        }

        var serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));

        if (serverDoc.writtenByStubs) {
          // We're not the first stub to write this doc. Just add our method ID
          // to the record.
          serverDoc.writtenByStubs[methodId] = true;
        } else {
          // First stub! Save the original value and our method ID.
          serverDoc.document = doc;
          serverDoc.flushCallbacks = [];
          serverDoc.writtenByStubs = Object.create(null);
          serverDoc.writtenByStubs[methodId] = true;
        }
      });
    });

    if (!isEmpty(docsWritten)) {
      self._documentsWrittenByStub[methodId] = docsWritten;
    }
  } // This is very much a private function we use to make the tests
  // take up fewer server resources after they complete.


  _unsubscribeAll() {
    keys(this._subscriptions).forEach(id => {
      const sub = this._subscriptions[id]; // Avoid killing the autoupdate subscription so that developers
      // still get hot code pushes when writing tests.
      //
      // XXX it's a hack to encode knowledge about autoupdate here,
      // but it doesn't seem worth it yet to have a special API for
      // subscriptions to preserve after unit tests.

      if (sub.name !== 'meteor_autoupdate_clientVersions') {
        sub.stop();
      }
    });
  } // Sends the DDP stringification of the given message object


  _send(obj) {
    this._stream.send(DDPCommon.stringifyDDP(obj));
  } // We detected via DDP-level heartbeats that we've lost the
  // connection.  Unlike `disconnect` or `close`, a lost connection
  // will be automatically retried.


  _lostConnection(error) {
    this._stream._lostConnection(error);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.status
   * @summary Get the current connection status. A reactive data source.
   * @locus Client
   */


  status() {
    return this._stream.status(...arguments);
  }
  /**
   * @summary Force an immediate reconnection attempt if the client is not connected to the server.
   This method does nothing if the client is already connected.
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.reconnect
   * @locus Client
   */


  reconnect() {
    return this._stream.reconnect(...arguments);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.disconnect
   * @summary Disconnect the client from the server.
   * @locus Client
   */


  disconnect() {
    return this._stream.disconnect(...arguments);
  }

  close() {
    return this._stream.disconnect({
      _permanent: true
    });
  } ///
  /// Reactive user system
  ///


  userId() {
    if (this._userIdDeps) this._userIdDeps.depend();
    return this._userId;
  }

  setUserId(userId) {
    // Avoid invalidating dependents if setUserId is called with current value.
    if (this._userId === userId) return;
    this._userId = userId;
    if (this._userIdDeps) this._userIdDeps.changed();
  } // Returns true if we are in a state after reconnect of waiting for subs to be
  // revived or early methods to finish their data, or we are waiting for a
  // "wait" method to finish.


  _waitingForQuiescence() {
    return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
  } // Returns true if any method whose message has been sent to the server has
  // not yet invoked its user callback.


  _anyMethodsAreOutstanding() {
    const invokers = this._methodInvokers;
    return keys(invokers).some(id => {
      return invokers[id].sentMessage;
    });
  }

  _livedata_connected(msg) {
    var self = this;

    if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
      self._heartbeat = new DDPCommon.Heartbeat({
        heartbeatInterval: self._heartbeatInterval,
        heartbeatTimeout: self._heartbeatTimeout,

        onTimeout() {
          self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
        },

        sendPing() {
          self._send({
            msg: 'ping'
          });
        }

      });

      self._heartbeat.start();
    } // If this is a reconnect, we'll have to reset all stores.


    if (self._lastSessionId) self._resetStores = true;

    if (typeof msg.session === 'string') {
      var reconnectedToPreviousSession = self._lastSessionId === msg.session;
      self._lastSessionId = msg.session;
    }

    if (reconnectedToPreviousSession) {
      // Successful reconnection -- pick up where we left off.  Note that right
      // now, this never happens: the server never connects us to a previous
      // session, because DDP doesn't provide enough data for the server to know
      // what messages the client has processed. We need to improve DDP to make
      // this possible, at which point we'll probably need more code here.
      return;
    } // Server doesn't have our data any more. Re-sync a new session.
    // Forget about messages we were buffering for unknown collections. They'll
    // be resent if still relevant.


    self._updatesForUnknownStores = Object.create(null);

    if (self._resetStores) {
      // Forget about the effects of stubs. We'll be resetting all collections
      // anyway.
      self._documentsWrittenByStub = Object.create(null);
      self._serverDocuments = Object.create(null);
    } // Clear _afterUpdateCallbacks.


    self._afterUpdateCallbacks = []; // Mark all named subscriptions which are ready (ie, we already called the
    // ready callback) as needing to be revived.
    // XXX We should also block reconnect quiescence until unnamed subscriptions
    //     (eg, autopublish) are done re-publishing to avoid flicker!

    self._subsBeingRevived = Object.create(null);
    keys(self._subscriptions).forEach(id => {
      if (self._subscriptions[id].ready) {
        self._subsBeingRevived[id] = true;
      }
    }); // Arrange for "half-finished" methods to have their callbacks run, and
    // track methods that were sent on this connection so that we don't
    // quiesce until they are all done.
    //
    // Start by clearing _methodsBlockingQuiescence: methods sent before
    // reconnect don't matter, and any "wait" methods sent on the new connection
    // that we drop here will be restored by the loop below.

    self._methodsBlockingQuiescence = Object.create(null);

    if (self._resetStores) {
      const invokers = self._methodInvokers;
      keys(invokers).forEach(id => {
        const invoker = invokers[id];

        if (invoker.gotResult()) {
          // This method already got its result, but it didn't call its callback
          // because its data didn't become visible. We did not resend the
          // method RPC. We'll call its callback when we get a full quiesce,
          // since that's as close as we'll get to "data must be visible".
          self._afterUpdateCallbacks.push(function () {
            return invoker.dataVisible(...arguments);
          });
        } else if (invoker.sentMessage) {
          // This method has been sent on this connection (maybe as a resend
          // from the last connection, maybe from onReconnect, maybe just very
          // quickly before processing the connected message).
          //
          // We don't need to do anything special to ensure its callbacks get
          // called, but we'll count it as a method which is preventing
          // reconnect quiescence. (eg, it might be a login method that was run
          // from onReconnect, and we don't want to see flicker by seeing a
          // logged-out state.)
          self._methodsBlockingQuiescence[invoker.methodId] = true;
        }
      });
    }

    self._messagesBufferedUntilQuiescence = []; // If we're not waiting on any methods or subs, we can reset the stores and
    // call the callbacks immediately.

    if (!self._waitingForQuiescence()) {
      if (self._resetStores) {
        keys(self._stores).forEach(storeName => {
          const s = self._stores[storeName];
          s.beginUpdate(0, true);
          s.endUpdate();
        });
        self._resetStores = false;
      }

      self._runAfterUpdateCallbacks();
    }
  }

  _processOneDataMessage(msg, updates) {
    const messageType = msg.msg; // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']

    if (messageType === 'added') {
      this._process_added(msg, updates);
    } else if (messageType === 'changed') {
      this._process_changed(msg, updates);
    } else if (messageType === 'removed') {
      this._process_removed(msg, updates);
    } else if (messageType === 'ready') {
      this._process_ready(msg, updates);
    } else if (messageType === 'updated') {
      this._process_updated(msg, updates);
    } else if (messageType === 'nosub') {// ignore this
    } else {
      Meteor._debug('discarding unknown livedata data message type', msg);
    }
  }

  _livedata_data(msg) {
    var self = this;

    if (self._waitingForQuiescence()) {
      self._messagesBufferedUntilQuiescence.push(msg);

      if (msg.msg === 'nosub') {
        delete self._subsBeingRevived[msg.id];
      }

      if (msg.subs) {
        msg.subs.forEach(subId => {
          delete self._subsBeingRevived[subId];
        });
      }

      if (msg.methods) {
        msg.methods.forEach(methodId => {
          delete self._methodsBlockingQuiescence[methodId];
        });
      }

      if (self._waitingForQuiescence()) {
        return;
      } // No methods or subs are blocking quiescence!
      // We'll now process and all of our buffered messages, reset all stores,
      // and apply them all at once.


      const bufferedMessages = self._messagesBufferedUntilQuiescence;
      keys(bufferedMessages).forEach(id => {
        self._processOneDataMessage(bufferedMessages[id], self._bufferedWrites);
      });
      self._messagesBufferedUntilQuiescence = [];
    } else {
      self._processOneDataMessage(msg, self._bufferedWrites);
    } // Immediately flush writes when:
    //  1. Buffering is disabled. Or;
    //  2. any non-(added/changed/removed) message arrives.


    var standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";

    if (self._bufferedWritesInterval === 0 || !standardWrite) {
      self._flushBufferedWrites();

      return;
    }

    if (self._bufferedWritesFlushAt === null) {
      self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
    } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
      self._flushBufferedWrites();

      return;
    }

    if (self._bufferedWritesFlushHandle) {
      clearTimeout(self._bufferedWritesFlushHandle);
    }

    self._bufferedWritesFlushHandle = setTimeout(self.__flushBufferedWrites, self._bufferedWritesInterval);
  }

  _flushBufferedWrites() {
    var self = this;

    if (self._bufferedWritesFlushHandle) {
      clearTimeout(self._bufferedWritesFlushHandle);
      self._bufferedWritesFlushHandle = null;
    }

    self._bufferedWritesFlushAt = null; // We need to clear the buffer before passing it to
    //  performWrites. As there's no guarantee that it
    //  will exit cleanly.

    var writes = self._bufferedWrites;
    self._bufferedWrites = Object.create(null);

    self._performWrites(writes);
  }

  _performWrites(updates) {
    var self = this;

    if (self._resetStores || !isEmpty(updates)) {
      // Begin a transactional update of each store.
      keys(self._stores).forEach(storeName => {
        self._stores[storeName].beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
      });
      self._resetStores = false;
      keys(updates).forEach(storeName => {
        const updateMessages = updates[storeName];
        var store = self._stores[storeName];

        if (store) {
          updateMessages.forEach(updateMessage => {
            store.update(updateMessage);
          });
        } else {
          // Nobody's listening for this data. Queue it up until
          // someone wants it.
          // XXX memory use will grow without bound if you forget to
          // create a collection or just don't care about it... going
          // to have to do something about that.
          const updates = self._updatesForUnknownStores;

          if (!hasOwn.call(updates, storeName)) {
            updates[storeName] = [];
          }

          updates[storeName].push(...updateMessages);
        }
      }); // End update transaction.

      keys(self._stores).forEach(storeName => {
        self._stores[storeName].endUpdate();
      });
    }

    self._runAfterUpdateCallbacks();
  } // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
  // relevant docs have been flushed, as well as dataVisible callbacks at
  // reconnect-quiescence time.


  _runAfterUpdateCallbacks() {
    var self = this;
    var callbacks = self._afterUpdateCallbacks;
    self._afterUpdateCallbacks = [];
    callbacks.forEach(c => {
      c();
    });
  }

  _pushUpdate(updates, collection, msg) {
    if (!hasOwn.call(updates, collection)) {
      updates[collection] = [];
    }

    updates[collection].push(msg);
  }

  _getServerDoc(collection, id) {
    var self = this;

    if (!hasOwn.call(self._serverDocuments, collection)) {
      return null;
    }

    var serverDocsForCollection = self._serverDocuments[collection];
    return serverDocsForCollection.get(id) || null;
  }

  _process_added(msg, updates) {
    var self = this;
    var id = MongoID.idParse(msg.id);

    var serverDoc = self._getServerDoc(msg.collection, id);

    if (serverDoc) {
      // Some outstanding stub wrote here.
      var isExisting = serverDoc.document !== undefined;
      serverDoc.document = msg.fields || Object.create(null);
      serverDoc.document._id = id;

      if (self._resetStores) {
        // During reconnect the server is sending adds for existing ids.
        // Always push an update so that document stays in the store after
        // reset. Use current version of the document for this update, so
        // that stub-written values are preserved.
        var currentDoc = self._stores[msg.collection].getDoc(msg.id);

        if (currentDoc !== undefined) msg.fields = currentDoc;

        self._pushUpdate(updates, msg.collection, msg);
      } else if (isExisting) {
        throw new Error('Server sent add for existing id: ' + msg.id);
      }
    } else {
      self._pushUpdate(updates, msg.collection, msg);
    }
  }

  _process_changed(msg, updates) {
    var self = this;

    var serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));

    if (serverDoc) {
      if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
      DiffSequence.applyChanges(serverDoc.document, msg.fields);
    } else {
      self._pushUpdate(updates, msg.collection, msg);
    }
  }

  _process_removed(msg, updates) {
    var self = this;

    var serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));

    if (serverDoc) {
      // Some outstanding stub wrote here.
      if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
      serverDoc.document = undefined;
    } else {
      self._pushUpdate(updates, msg.collection, {
        msg: 'removed',
        collection: msg.collection,
        id: msg.id
      });
    }
  }

  _process_updated(msg, updates) {
    var self = this; // Process "method done" messages.

    msg.methods.forEach(methodId => {
      const docs = self._documentsWrittenByStub[methodId];
      keys(docs).forEach(id => {
        const written = docs[id];

        const serverDoc = self._getServerDoc(written.collection, written.id);

        if (!serverDoc) {
          throw new Error('Lost serverDoc for ' + JSON.stringify(written));
        }

        if (!serverDoc.writtenByStubs[methodId]) {
          throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
        }

        delete serverDoc.writtenByStubs[methodId];

        if (isEmpty(serverDoc.writtenByStubs)) {
          // All methods whose stubs wrote this method have completed! We can
          // now copy the saved document to the database (reverting the stub's
          // change if the server did not write to this object, or applying the
          // server's writes if it did).
          // This is a fake ddp 'replace' message.  It's just for talking
          // between livedata connections and minimongo.  (We have to stringify
          // the ID because it's supposed to look like a wire message.)
          self._pushUpdate(updates, written.collection, {
            msg: 'replace',
            id: MongoID.idStringify(written.id),
            replace: serverDoc.document
          }); // Call all flush callbacks.


          serverDoc.flushCallbacks.forEach(c => {
            c();
          }); // Delete this completed serverDocument. Don't bother to GC empty
          // IdMaps inside self._serverDocuments, since there probably aren't
          // many collections and they'll be written repeatedly.

          self._serverDocuments[written.collection].remove(written.id);
        }
      });
      delete self._documentsWrittenByStub[methodId]; // We want to call the data-written callback, but we can't do so until all
      // currently buffered messages are flushed.

      const callbackInvoker = self._methodInvokers[methodId];

      if (!callbackInvoker) {
        throw new Error('No callback invoker for method ' + methodId);
      }

      self._runWhenAllServerDocsAreFlushed(function () {
        return callbackInvoker.dataVisible(...arguments);
      });
    });
  }

  _process_ready(msg, updates) {
    var self = this; // Process "sub ready" messages. "sub ready" messages don't take effect
    // until all current server documents have been flushed to the local
    // database. We can use a write fence to implement this.

    msg.subs.forEach(subId => {
      self._runWhenAllServerDocsAreFlushed(() => {
        var subRecord = self._subscriptions[subId]; // Did we already unsubscribe?

        if (!subRecord) return; // Did we already receive a ready message? (Oops!)

        if (subRecord.ready) return;
        subRecord.ready = true;
        subRecord.readyCallback && subRecord.readyCallback();
        subRecord.readyDeps.changed();
      });
    });
  } // Ensures that "f" will be called after all documents currently in
  // _serverDocuments have been written to the local cache. f will not be called
  // if the connection is lost before then!


  _runWhenAllServerDocsAreFlushed(f) {
    var self = this;

    var runFAfterUpdates = () => {
      self._afterUpdateCallbacks.push(f);
    };

    var unflushedServerDocCount = 0;

    var onServerDocFlush = () => {
      --unflushedServerDocCount;

      if (unflushedServerDocCount === 0) {
        // This was the last doc to flush! Arrange to run f after the updates
        // have been applied.
        runFAfterUpdates();
      }
    };

    keys(self._serverDocuments).forEach(collection => {
      self._serverDocuments[collection].forEach(serverDoc => {
        const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
          var invoker = self._methodInvokers[methodId];
          return invoker && invoker.sentMessage;
        });

        if (writtenByStubForAMethodWithSentMessage) {
          ++unflushedServerDocCount;
          serverDoc.flushCallbacks.push(onServerDocFlush);
        }
      });
    });

    if (unflushedServerDocCount === 0) {
      // There aren't any buffered docs --- we can call f as soon as the current
      // round of updates is applied!
      runFAfterUpdates();
    }
  }

  _livedata_nosub(msg) {
    var self = this; // First pass it through _livedata_data, which only uses it to help get
    // towards quiescence.

    self._livedata_data(msg); // Do the rest of our processing immediately, with no
    // buffering-until-quiescence.
    // we weren't subbed anyway, or we initiated the unsub.


    if (!hasOwn.call(self._subscriptions, msg.id)) {
      return;
    } // XXX COMPAT WITH 1.0.3.1 #errorCallback


    var errorCallback = self._subscriptions[msg.id].errorCallback;
    var stopCallback = self._subscriptions[msg.id].stopCallback;

    self._subscriptions[msg.id].remove();

    var meteorErrorFromMsg = msgArg => {
      return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
    }; // XXX COMPAT WITH 1.0.3.1 #errorCallback


    if (errorCallback && msg.error) {
      errorCallback(meteorErrorFromMsg(msg));
    }

    if (stopCallback) {
      stopCallback(meteorErrorFromMsg(msg));
    }
  }

  _livedata_result(msg) {
    // id, result or error. error has error (code), reason, details
    var self = this; // Lets make sure there are no buffered writes before returning result.

    if (!isEmpty(self._bufferedWrites)) {
      self._flushBufferedWrites();
    } // find the outstanding request
    // should be O(1) in nearly all realistic use cases


    if (isEmpty(self._outstandingMethodBlocks)) {
      Meteor._debug('Received method result but no methods outstanding');

      return;
    }

    var currentMethodBlock = self._outstandingMethodBlocks[0].methods;
    var m;

    for (var i = 0; i < currentMethodBlock.length; i++) {
      m = currentMethodBlock[i];
      if (m.methodId === msg.id) break;
    }

    if (!m) {
      Meteor._debug("Can't match method response to original method call", msg);

      return;
    } // Remove from current method block. This may leave the block empty, but we
    // don't move on to the next block until the callback has been delivered, in
    // _outstandingMethodFinished.


    currentMethodBlock.splice(i, 1);

    if (hasOwn.call(msg, 'error')) {
      m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
    } else {
      // msg.result may be undefined if the method didn't return a
      // value
      m.receiveResult(undefined, msg.result);
    }
  } // Called by MethodInvoker after a method's callback is invoked.  If this was
  // the last outstanding method in the current block, runs the next block. If
  // there are no more methods, consider accepting a hot code push.


  _outstandingMethodFinished() {
    var self = this;
    if (self._anyMethodsAreOutstanding()) return; // No methods are outstanding. This should mean that the first block of
    // methods is empty. (Or it might not exist, if this was a method that
    // half-finished before disconnect/reconnect.)

    if (!isEmpty(self._outstandingMethodBlocks)) {
      var firstBlock = self._outstandingMethodBlocks.shift();

      if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock)); // Send the outstanding methods now in the first block.

      if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
    } // Maybe accept a hot code push.


    self._maybeMigrate();
  } // Sends messages for all the methods in the first block in
  // _outstandingMethodBlocks.


  _sendOutstandingMethods() {
    var self = this;

    if (isEmpty(self._outstandingMethodBlocks)) {
      return;
    }

    self._outstandingMethodBlocks[0].methods.forEach(m => {
      m.sendMessage();
    });
  }

  _livedata_error(msg) {
    Meteor._debug('Received error from server: ', msg.reason);

    if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
  }

  _callOnReconnectAndSendAppropriateOutstandingMethods() {
    var self = this;
    var oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
    self._outstandingMethodBlocks = [];
    self.onReconnect && self.onReconnect();

    DDP._reconnectHook.each(callback => {
      callback(self);
      return true;
    });

    if (isEmpty(oldOutstandingMethodBlocks)) return; // We have at least one block worth of old outstanding methods to try
    // again. First: did onReconnect actually send anything? If not, we just
    // restore all outstanding methods and run the first block.

    if (isEmpty(self._outstandingMethodBlocks)) {
      self._outstandingMethodBlocks = oldOutstandingMethodBlocks;

      self._sendOutstandingMethods();

      return;
    } // OK, there are blocks on both sides. Special case: merge the last block of
    // the reconnect methods with the first block of the original methods, if
    // neither of them are "wait" blocks.


    if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
      oldOutstandingMethodBlocks[0].methods.forEach(m => {
        last(self._outstandingMethodBlocks).methods.push(m); // If this "last block" is also the first block, send the message.

        if (self._outstandingMethodBlocks.length === 1) {
          m.sendMessage();
        }
      });
      oldOutstandingMethodBlocks.shift();
    } // Now add the rest of the original blocks on.


    oldOutstandingMethodBlocks.forEach(block => {
      self._outstandingMethodBlocks.push(block);
    });
  } // We can accept a hot code push if there are no methods in flight.


  _readyToMigrate() {
    return isEmpty(this._methodInvokers);
  } // If we were blocking a migration, see if it's now possible to continue.
  // Call whenever the set of outstanding/blocked methods shrinks.


  _maybeMigrate() {
    var self = this;

    if (self._retryMigrate && self._readyToMigrate()) {
      self._retryMigrate();

      self._retryMigrate = null;
    }
  }

  onMessage(raw_msg) {
    try {
      var msg = DDPCommon.parseDDP(raw_msg);
    } catch (e) {
      Meteor._debug('Exception while parsing DDP', e);

      return;
    } // Any message counts as receiving a pong, as it demonstrates that
    // the server is still alive.


    if (this._heartbeat) {
      this._heartbeat.messageReceived();
    }

    if (msg === null || !msg.msg) {
      // XXX COMPAT WITH 0.6.6. ignore the old welcome message for back
      // compat.  Remove this 'if' once the server stops sending welcome
      // messages (stream_server.js).
      if (!(msg && msg.server_id)) Meteor._debug('discarding invalid livedata message', msg);
      return;
    }

    if (msg.msg === 'connected') {
      this._version = this._versionSuggestion;

      this._livedata_connected(msg);

      this.options.onConnected();
    } else if (msg.msg === 'failed') {
      if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
        this._versionSuggestion = msg.version;

        this._stream.reconnect({
          _force: true
        });
      } else {
        var description = 'DDP version negotiation failed; server requested version ' + msg.version;

        this._stream.disconnect({
          _permanent: true,
          _error: description
        });

        this.options.onDDPVersionNegotiationFailure(description);
      }
    } else if (msg.msg === 'ping' && this.options.respondToPings) {
      this._send({
        msg: 'pong',
        id: msg.id
      });
    } else if (msg.msg === 'pong') {// noop, as we assume everything's a pong
    } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
      this._livedata_data(msg);
    } else if (msg.msg === 'nosub') {
      this._livedata_nosub(msg);
    } else if (msg.msg === 'result') {
      this._livedata_result(msg);
    } else if (msg.msg === 'error') {
      this._livedata_error(msg);
    } else {
      Meteor._debug('discarding unknown livedata message type', msg);
    }
  }

  onReset() {
    // Send a connect message at the beginning of the stream.
    // NOTE: reset is called even on the first connection, so this is
    // the only place we send this message.
    var msg = {
      msg: 'connect'
    };
    if (this._lastSessionId) msg.session = this._lastSessionId;
    msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
    this._versionSuggestion = msg.version;
    msg.support = this._supportedDDPVersions;

    this._send(msg); // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
    // current block is pretty important to making sure that quiescence is properly calculated, as
    // well as possibly moving on to another useful block.
    // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
    // we are connecting for the first time.


    if (this._outstandingMethodBlocks.length > 0) {
      // If there is an outstanding method block, we only care about the first one as that is the
      // one that could have already sent messages with no response, that are not allowed to retry.
      const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
      this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
        // Methods with 'noRetry' option set are not allowed to re-send after
        // recovering dropped connection.
        if (methodInvoker.sentMessage && methodInvoker.noRetry) {
          // Make sure that the method is told that it failed.
          methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
        } // Only keep a method if it wasn't sent or it's allowed to retry.
        // This may leave the block empty, but we don't move on to the next
        // block until the callback has been delivered, in _outstandingMethodFinished.


        return !(methodInvoker.sentMessage && methodInvoker.noRetry);
      });
    } // Now, to minimize setup latency, go ahead and blast out all of
    // our pending methods ands subscriptions before we've even taken
    // the necessary RTT to know if we successfully reconnected. (1)
    // They're supposed to be idempotent, and where they are not,
    // they can block retry in apply; (2) even if we did reconnect,
    // we're not sure what messages might have gotten lost
    // (in either direction) since we were disconnected (TCP being
    // sloppy about that.)
    // If the current block of methods all got their results (but didn't all get
    // their data visible), discard the empty block now.


    if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
      this._outstandingMethodBlocks.shift();
    } // Mark all messages as unsent, they have not yet been sent on this
    // connection.


    keys(this._methodInvokers).forEach(id => {
      this._methodInvokers[id].sentMessage = false;
    }); // If an `onReconnect` handler is set, call it first. Go through
    // some hoops to ensure that methods that are called from within
    // `onReconnect` get executed _before_ ones that were originally
    // outstanding (since `onReconnect` is used to re-establish auth
    // certificates)

    this._callOnReconnectAndSendAppropriateOutstandingMethods(); // add new subscriptions at the end. this way they take effect after
    // the handlers and we don't see flicker.


    keys(this._subscriptions).forEach(id => {
      const sub = this._subscriptions[id];

      this._send({
        msg: 'sub',
        id: id,
        name: sub.name,
        params: sub.params
      });
    });
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/namespace.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DDP: () => DDP
});
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }

}, 0);
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 1);
let keys;
module.link("meteor/ddp-common/utils.js", {
  keys(v) {
    keys = v;
  }

}, 2);
let Connection;
module.link("./livedata_connection.js", {
  Connection(v) {
    Connection = v;
  }

}, 3);
// This array allows the `_allSubscriptionsReady` method below, which
// is used by the `spiderable` package, to keep track of whether all
// data is ready.
const allConnections = [];
/**
 * @namespace DDP
 * @summary Namespace for DDP-related methods/classes.
 */

const DDP = {};
// This is private but it's used in a few places. accounts-base uses
// it to get the current user. Meteor.setTimeout and friends clear
// it. We can probably find a better way to factor this.
DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable(); // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.

DDP._CurrentInvocation = DDP._CurrentMethodInvocation; // This is passed into a weird `makeErrorType` function that expects its thing
// to be a constructor

function connectionErrorConstructor(message) {
  this.message = message;
}

DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {}); // Returns the named sequence of pseudo-random values.
// The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
// consistent values for method calls on the client and server.

DDP.randomStream = name => {
  var scope = DDP._CurrentMethodInvocation.get();

  return DDPCommon.RandomStream.get(scope, name);
}; // @param url {String} URL to Meteor app,
//     e.g.:
//     "subdomain.meteor.com",
//     "http://subdomain.meteor.com",
//     "/",
//     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

/**
 * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
 * @locus Anywhere
 * @param {String} url The URL of another Meteor application.
 */


DDP.connect = (url, options) => {
  var ret = new Connection(url, options);
  allConnections.push(ret); // hack. see below.

  return ret;
};

DDP._reconnectHook = new Hook({
  bindEnvironment: false
});
/**
 * @summary Register a function to call as the first step of
 * reconnecting. This function can call methods which will be executed before
 * any other outstanding methods. For example, this can be used to re-establish
 * the appropriate authentication context on the connection.
 * @locus Anywhere
 * @param {Function} callback The function to call. It will be called with a
 * single argument, the [connection object](#ddp_connect) that is reconnecting.
 */

DDP.onReconnect = callback => {
  return DDP._reconnectHook.register(callback);
}; // Hack for `spiderable` package: a way to see if the page is done
// loading all the data it needs.
//


DDP._allSubscriptionsReady = () => {
  return allConnections.every(conn => {
    return keys(conn._subscriptions).every(id => {
      return conn._subscriptions[id].ready;
    });
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/ddp-client/server/server.js");

/* Exports */
Package._define("ddp-client", exports, {
  DDP: DDP
});

})();

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsImV4cG9ydCIsImRlZmF1bHQiLCJNZXRob2RJbnZva2VyIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwibWV0aG9kSWQiLCJzZW50TWVzc2FnZSIsIl9jYWxsYmFjayIsImNhbGxiYWNrIiwiX2Nvbm5lY3Rpb24iLCJjb25uZWN0aW9uIiwiX21lc3NhZ2UiLCJtZXNzYWdlIiwiX29uUmVzdWx0UmVjZWl2ZWQiLCJvblJlc3VsdFJlY2VpdmVkIiwiX3dhaXQiLCJ3YWl0Iiwibm9SZXRyeSIsIl9tZXRob2RSZXN1bHQiLCJfZGF0YVZpc2libGUiLCJfbWV0aG9kSW52b2tlcnMiLCJzZW5kTWVzc2FnZSIsImdvdFJlc3VsdCIsIkVycm9yIiwiX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UiLCJfc2VuZCIsIl9tYXliZUludm9rZUNhbGxiYWNrIiwiX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQiLCJyZWNlaXZlUmVzdWx0IiwiZXJyIiwicmVzdWx0IiwiZGF0YVZpc2libGUiLCJfb2JqZWN0U3ByZWFkIiwidiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiaXNTZXJ2ZXIiLCJGaWJlciIsIk5wbSIsInJlcXVpcmUiLCJGdXR1cmUiLCJNb25nb0lETWFwIiwiSWRNYXAiLCJpZFN0cmluZ2lmeSIsImlkUGFyc2UiLCJ1cmwiLCJzZWxmIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsIkNvbm5lY3Rpb25FcnJvciIsImhlYWRlcnMiLCJfc29ja2pzT3B0aW9ucyIsIl9kb250UHJpbnRFcnJvcnMiLCJjb25uZWN0VGltZW91dE1zIiwiX2xhc3RTZXNzaW9uSWQiLCJfdmVyc2lvblN1Z2dlc3Rpb24iLCJfdmVyc2lvbiIsIl9zdG9yZXMiLCJfbWV0aG9kSGFuZGxlcnMiLCJfbmV4dE1ldGhvZElkIiwiX3N1cHBvcnRlZEREUFZlcnNpb25zIiwiX2hlYXJ0YmVhdEludGVydmFsIiwiX2hlYXJ0YmVhdFRpbWVvdXQiLCJfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiIsIl9zZXJ2ZXJEb2N1bWVudHMiLCJfYWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSIsIl9zdWJzQmVpbmdSZXZpdmVkIiwiX3Jlc2V0U3RvcmVzIiwiX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzIiwiX3JldHJ5TWlncmF0ZSIsIl9fZmx1c2hCdWZmZXJlZFdyaXRlcyIsImJpbmRFbnZpcm9ubWVudCIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlIiwiX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJfYnVmZmVyZWRXcml0ZXNNYXhBZ2UiLCJfc3Vic2NyaXB0aW9ucyIsIl91c2VySWQiLCJfdXNlcklkRGVwcyIsIkRlcGVuZGVuY3kiLCJpc0NsaWVudCIsIlBhY2thZ2UiLCJyZWxvYWQiLCJSZWxvYWQiLCJfb25NaWdyYXRlIiwiX3JlYWR5VG9NaWdyYXRlIiwib25EaXNjb25uZWN0IiwiX2hlYXJ0YmVhdCIsInN0b3AiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwicmVnaXN0ZXJTdG9yZSIsIm5hbWUiLCJ3cmFwcGVkU3RvcmUiLCJzdG9yZSIsImZvckVhY2giLCJtZXRob2QiLCJxdWV1ZWQiLCJiZWdpblVwZGF0ZSIsImxlbmd0aCIsIm1zZyIsInVwZGF0ZSIsImVuZFVwZGF0ZSIsInN1YnNjcmliZSIsInBhcmFtcyIsImNhbGwiLCJhcmd1bWVudHMiLCJjYWxsYmFja3MiLCJsYXN0UGFyYW0iLCJvblJlYWR5IiwicG9wIiwib25FcnJvciIsIm9uU3RvcCIsInNvbWUiLCJmIiwiZXhpc3RpbmciLCJpZCIsInN1YiIsImluYWN0aXZlIiwiZXF1YWxzIiwicmVhZHkiLCJyZWFkeUNhbGxiYWNrIiwiZXJyb3JDYWxsYmFjayIsInN0b3BDYWxsYmFjayIsImNsb25lIiwicmVhZHlEZXBzIiwicmVtb3ZlIiwiY2hhbmdlZCIsImhhbmRsZSIsInJlY29yZCIsImRlcGVuZCIsInN1YnNjcmlwdGlvbklkIiwiYWN0aXZlIiwib25JbnZhbGlkYXRlIiwiYyIsImFmdGVyRmx1c2giLCJfc3Vic2NyaWJlQW5kV2FpdCIsImFyZ3MiLCJwdXNoIiwiZSIsIm9uTGF0ZUVycm9yIiwiYXBwbHkiLCJjb25jYXQiLCJtZXRob2RzIiwiZnVuYyIsImVuY2xvc2luZyIsIl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsImdldCIsImFscmVhZHlJblNpbXVsYXRpb24iLCJpc1NpbXVsYXRpb24iLCJyYW5kb21TZWVkIiwicmFuZG9tU2VlZEdlbmVyYXRvciIsIm1ha2VScGNTZWVkIiwic3R1YiIsInNldFVzZXJJZCIsInVzZXJJZCIsImludm9jYXRpb24iLCJNZXRob2RJbnZvY2F0aW9uIiwiX3NhdmVPcmlnaW5hbHMiLCJzdHViUmV0dXJuVmFsdWUiLCJ3aXRoVmFsdWUiLCJfbm9ZaWVsZHNBbGxvd2VkIiwiZXhjZXB0aW9uIiwidW5kZWZpbmVkIiwiX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMiLCJ0aHJvd1N0dWJFeGNlcHRpb25zIiwiX2V4cGVjdGVkQnlUZXN0IiwiZnV0dXJlIiwicmVzb2x2ZXIiLCJtZXRob2RJbnZva2VyIiwicmV0dXJuU3R1YlZhbHVlIiwiX3dhaXRpbmdGb3JRdWllc2NlbmNlIiwic3RvcmVOYW1lIiwic2F2ZU9yaWdpbmFscyIsImRvY3NXcml0dGVuIiwiY29sbGVjdGlvbiIsIm9yaWdpbmFscyIsInJldHJpZXZlT3JpZ2luYWxzIiwiZG9jIiwic2VydmVyRG9jIiwic2V0RGVmYXVsdCIsIndyaXR0ZW5CeVN0dWJzIiwiZG9jdW1lbnQiLCJmbHVzaENhbGxiYWNrcyIsIl91bnN1YnNjcmliZUFsbCIsIm9iaiIsInNlbmQiLCJzdHJpbmdpZnlERFAiLCJfbG9zdENvbm5lY3Rpb24iLCJlcnJvciIsInN0YXR1cyIsInJlY29ubmVjdCIsImRpc2Nvbm5lY3QiLCJjbG9zZSIsIl9wZXJtYW5lbnQiLCJfYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nIiwiaW52b2tlcnMiLCJfbGl2ZWRhdGFfY29ubmVjdGVkIiwiSGVhcnRiZWF0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsInNlc3Npb24iLCJyZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uIiwiaW52b2tlciIsInMiLCJfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfcHJvY2Vzc09uZURhdGFNZXNzYWdlIiwidXBkYXRlcyIsIm1lc3NhZ2VUeXBlIiwiX3Byb2Nlc3NfYWRkZWQiLCJfcHJvY2Vzc19jaGFuZ2VkIiwiX3Byb2Nlc3NfcmVtb3ZlZCIsIl9wcm9jZXNzX3JlYWR5IiwiX3Byb2Nlc3NfdXBkYXRlZCIsIl9saXZlZGF0YV9kYXRhIiwic3VicyIsInN1YklkIiwiYnVmZmVyZWRNZXNzYWdlcyIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJ3cml0ZXMiLCJfcGVyZm9ybVdyaXRlcyIsInVwZGF0ZU1lc3NhZ2VzIiwidXBkYXRlTWVzc2FnZSIsIl9wdXNoVXBkYXRlIiwiX2dldFNlcnZlckRvYyIsInNlcnZlckRvY3NGb3JDb2xsZWN0aW9uIiwiaXNFeGlzdGluZyIsImZpZWxkcyIsIl9pZCIsImN1cnJlbnREb2MiLCJnZXREb2MiLCJEaWZmU2VxdWVuY2UiLCJhcHBseUNoYW5nZXMiLCJkb2NzIiwid3JpdHRlbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJyZXBsYWNlIiwiY2FsbGJhY2tJbnZva2VyIiwiX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCIsInN1YlJlY29yZCIsInJ1bkZBZnRlclVwZGF0ZXMiLCJ1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCIsIm9uU2VydmVyRG9jRmx1c2giLCJ3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSIsIl9saXZlZGF0YV9ub3N1YiIsIm1ldGVvckVycm9yRnJvbU1zZyIsIm1zZ0FyZyIsInJlYXNvbiIsImRldGFpbHMiLCJfbGl2ZWRhdGFfcmVzdWx0IiwiY3VycmVudE1ldGhvZEJsb2NrIiwibSIsImkiLCJzcGxpY2UiLCJmaXJzdEJsb2NrIiwic2hpZnQiLCJfc2VuZE91dHN0YW5kaW5nTWV0aG9kcyIsIl9tYXliZU1pZ3JhdGUiLCJfbGl2ZWRhdGFfZXJyb3IiLCJvZmZlbmRpbmdNZXNzYWdlIiwiX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcyIsIm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX3JlY29ubmVjdEhvb2siLCJlYWNoIiwiYmxvY2siLCJyYXdfbXNnIiwicGFyc2VERFAiLCJtZXNzYWdlUmVjZWl2ZWQiLCJzZXJ2ZXJfaWQiLCJpbmRleE9mIiwidmVyc2lvbiIsIl9mb3JjZSIsIl9lcnJvciIsImluY2x1ZGVzIiwic3VwcG9ydCIsImZpbHRlciIsImFsbENvbm5lY3Rpb25zIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IiLCJtYWtlRXJyb3JUeXBlIiwiRm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyYW5kb21TdHJlYW0iLCJzY29wZSIsIlJhbmRvbVN0cmVhbSIsImNvbm5lY3QiLCJyZXQiLCJyZWdpc3RlciIsIl9hbGxTdWJzY3JpcHRpb25zUmVhZHkiLCJldmVyeSIsImNvbm4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxNQUFNLENBQUNDLElBQVAsQ0FBWSx3QkFBWixFQUFxQztBQUFDQyxLQUFHLEVBQUM7QUFBTCxDQUFyQyxFQUFpRCxDQUFqRCxFOzs7Ozs7Ozs7OztBQ0FBRixNQUFNLENBQUNHLE1BQVAsQ0FBYztBQUFDQyxTQUFPLEVBQUMsTUFBSUM7QUFBYixDQUFkOztBQUtlLE1BQU1BLGFBQU4sQ0FBb0I7QUFDakNDLGFBQVcsQ0FBQ0MsT0FBRCxFQUFVO0FBQ25CO0FBQ0EsU0FBS0MsUUFBTCxHQUFnQkQsT0FBTyxDQUFDQyxRQUF4QjtBQUNBLFNBQUtDLFdBQUwsR0FBbUIsS0FBbkI7QUFFQSxTQUFLQyxTQUFMLEdBQWlCSCxPQUFPLENBQUNJLFFBQXpCO0FBQ0EsU0FBS0MsV0FBTCxHQUFtQkwsT0FBTyxDQUFDTSxVQUEzQjtBQUNBLFNBQUtDLFFBQUwsR0FBZ0JQLE9BQU8sQ0FB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c0NvbnRlbnQiOlsiZXhwb3J0IHsgRERQIH0gZnJvbSAnLi4vY29tbW9uL25hbWVzcGFjZS5qcyc7XG4iLCIvLyBBIE1ldGhvZEludm9rZXIgbWFuYWdlcyBzZW5kaW5nIGEgbWV0aG9kIHRvIHRoZSBzZXJ2ZXIgYW5kIGNhbGxpbmcgdGhlIHVzZXInc1xuLy8gY2FsbGJhY2tzLiBPbiBjb25zdHJ1Y3Rpb24sIGl0IHJlZ2lzdGVycyBpdHNlbGYgaW4gdGhlIGNvbm5lY3Rpb24nc1xuLy8gX21ldGhvZEludm9rZXJzIG1hcDsgaXQgcmVtb3ZlcyBpdHNlbGYgb25jZSB0aGUgbWV0aG9kIGlzIGZ1bGx5IGZpbmlzaGVkIGFuZFxuLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQuIFRoaXMgb2NjdXJzIHdoZW4gaXQgaGFzIGJvdGggcmVjZWl2ZWQgYSByZXN1bHQsXG4vLyBhbmQgdGhlIGRhdGEgd3JpdHRlbiBieSBpdCBpcyBmdWxseSB2aXNpYmxlLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0aG9kSW52b2tlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBQdWJsaWMgKHdpdGhpbiB0aGlzIGZpbGUpIGZpZWxkcy5cbiAgICB0aGlzLm1ldGhvZElkID0gb3B0aW9ucy5tZXRob2RJZDtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gZmFsc2U7XG5cbiAgICB0aGlzLl9jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgICB0aGlzLl9tZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQgPSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLl93YWl0ID0gb3B0aW9ucy53YWl0O1xuICAgIHRoaXMubm9SZXRyeSA9IG9wdGlvbnMubm9SZXRyeTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBudWxsO1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAvLyBSZWdpc3RlciB3aXRoIHRoZSBjb25uZWN0aW9uLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdID0gdGhpcztcbiAgfVxuICAvLyBTZW5kcyB0aGUgbWV0aG9kIG1lc3NhZ2UgdG8gdGhlIHNlcnZlci4gTWF5IGJlIGNhbGxlZCBhZGRpdGlvbmFsIHRpbWVzIGlmXG4gIC8vIHdlIGxvc2UgdGhlIGNvbm5lY3Rpb24gYW5kIHJlY29ubmVjdCBiZWZvcmUgcmVjZWl2aW5nIGEgcmVzdWx0LlxuICBzZW5kTWVzc2FnZSgpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgc2VuZGluZyBhIG1ldGhvZCAoaW5jbHVkaW5nIHJlc2VuZGluZyBvblxuICAgIC8vIHJlY29ubmVjdCkuIFdlIHNob3VsZCBvbmx5IChyZSlzZW5kIG1ldGhvZHMgd2hlcmUgd2UgZG9uJ3QgYWxyZWFkeSBoYXZlIGFcbiAgICAvLyByZXN1bHQhXG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRpbmdNZXRob2QgaXMgY2FsbGVkIG9uIG1ldGhvZCB3aXRoIHJlc3VsdCcpO1xuXG4gICAgLy8gSWYgd2UncmUgcmUtc2VuZGluZyBpdCwgaXQgZG9lc24ndCBtYXR0ZXIgaWYgZGF0YSB3YXMgd3JpdHRlbiB0aGUgZmlyc3RcbiAgICAvLyB0aW1lLlxuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5zZW50TWVzc2FnZSA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgd2FpdCBtZXRob2QsIG1ha2UgYWxsIGRhdGEgbWVzc2FnZXMgYmUgYnVmZmVyZWQgdW50aWwgaXQgaXNcbiAgICAvLyBkb25lLlxuICAgIGlmICh0aGlzLl93YWl0KVxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVt0aGlzLm1ldGhvZElkXSA9IHRydWU7XG5cbiAgICAvLyBBY3R1YWxseSBzZW5kIHRoZSBtZXNzYWdlLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3NlbmQodGhpcy5fbWVzc2FnZSk7XG4gIH1cbiAgLy8gSW52b2tlIHRoZSBjYWxsYmFjaywgaWYgd2UgaGF2ZSBib3RoIGEgcmVzdWx0IGFuZCBrbm93IHRoYXQgYWxsIGRhdGEgaGFzXG4gIC8vIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuXG4gIF9tYXliZUludm9rZUNhbGxiYWNrKCkge1xuICAgIGlmICh0aGlzLl9tZXRob2RSZXN1bHQgJiYgdGhpcy5fZGF0YVZpc2libGUpIHtcbiAgICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrLiAoVGhpcyB3b24ndCB0aHJvdzogdGhlIGNhbGxiYWNrIHdhcyB3cmFwcGVkIHdpdGhcbiAgICAgIC8vIGJpbmRFbnZpcm9ubWVudC4pXG4gICAgICB0aGlzLl9jYWxsYmFjayh0aGlzLl9tZXRob2RSZXN1bHRbMF0sIHRoaXMuX21ldGhvZFJlc3VsdFsxXSk7XG5cbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGlzIG1ldGhvZC5cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RJbnZva2Vyc1t0aGlzLm1ldGhvZElkXTtcblxuICAgICAgLy8gTGV0IHRoZSBjb25uZWN0aW9uIGtub3cgdGhhdCB0aGlzIG1ldGhvZCBpcyBmaW5pc2hlZCwgc28gaXQgY2FuIHRyeSB0b1xuICAgICAgLy8gbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayBvZiBtZXRob2RzLlxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpO1xuICAgIH1cbiAgfVxuICAvLyBDYWxsIHdpdGggdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGZyb20gdGhlIHNlcnZlci4gT25seSBtYXkgYmUgY2FsbGVkXG4gIC8vIG9uY2U7IG9uY2UgaXQgaXMgY2FsbGVkLCB5b3Ugc2hvdWxkIG5vdCBjYWxsIHNlbmRNZXNzYWdlIGFnYWluLlxuICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhbiBvblJlc3VsdFJlY2VpdmVkIGNhbGxiYWNrLCBjYWxsIGl0IGltbWVkaWF0ZWx5LlxuICAvLyBUaGVuIGludm9rZSB0aGUgbWFpbiBjYWxsYmFjayBpZiBkYXRhIGlzIGFsc28gdmlzaWJsZS5cbiAgcmVjZWl2ZVJlc3VsdChlcnIsIHJlc3VsdCkge1xuICAgIGlmICh0aGlzLmdvdFJlc3VsdCgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2RzIHNob3VsZCBvbmx5IHJlY2VpdmUgcmVzdWx0cyBvbmNlJyk7XG4gICAgdGhpcy5fbWV0aG9kUmVzdWx0ID0gW2VyciwgcmVzdWx0XTtcbiAgICB0aGlzLl9vblJlc3VsdFJlY2VpdmVkKGVyciwgcmVzdWx0KTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gQ2FsbCB0aGlzIHdoZW4gYWxsIGRhdGEgd3JpdHRlbiBieSB0aGUgbWV0aG9kIGlzIHZpc2libGUuIFRoaXMgbWVhbnMgdGhhdFxuICAvLyB0aGUgbWV0aG9kIGhhcyByZXR1cm5zIGl0cyBcImRhdGEgaXMgZG9uZVwiIG1lc3NhZ2UgKkFORCogYWxsIHNlcnZlclxuICAvLyBkb2N1bWVudHMgdGhhdCBhcmUgYnVmZmVyZWQgYXQgdGhhdCB0aW1lIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbFxuICAvLyBjYWNoZS4gSW52b2tlcyB0aGUgbWFpbiBjYWxsYmFjayBpZiB0aGUgcmVzdWx0IGhhcyBiZWVuIHJlY2VpdmVkLlxuICBkYXRhVmlzaWJsZSgpIHtcbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5fbWF5YmVJbnZva2VDYWxsYmFjaygpO1xuICB9XG4gIC8vIFRydWUgaWYgcmVjZWl2ZVJlc3VsdCBoYXMgYmVlbiBjYWxsZWQuXG4gIGdvdFJlc3VsdCgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9tZXRob2RSZXN1bHQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gJ21ldGVvci90cmFja2VyJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgSG9vayB9IGZyb20gJ21ldGVvci9jYWxsYmFjay1ob29rJztcbmltcG9ydCB7IE1vbmdvSUQgfSBmcm9tICdtZXRlb3IvbW9uZ28taWQnO1xuaW1wb3J0IHsgRERQIH0gZnJvbSAnLi9uYW1lc3BhY2UuanMnO1xuaW1wb3J0IE1ldGhvZEludm9rZXIgZnJvbSAnLi9NZXRob2RJbnZva2VyLmpzJztcbmltcG9ydCB7XG4gIGhhc093bixcbiAgc2xpY2UsXG4gIGtleXMsXG4gIGlzRW1wdHksXG4gIGxhc3QsXG59IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gIHZhciBGaWJlciA9IE5wbS5yZXF1aXJlKCdmaWJlcnMnKTtcbiAgdmFyIEZ1dHVyZSA9IE5wbS5yZXF1aXJlKCdmaWJlcnMvZnV0dXJlJyk7XG59XG5cbmNsYXNzIE1vbmdvSURNYXAgZXh0ZW5kcyBJZE1hcCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKE1vbmdvSUQuaWRTdHJpbmdpZnksIE1vbmdvSUQuaWRQYXJzZSk7XG4gIH1cbn1cblxuLy8gQHBhcmFtIHVybCB7U3RyaW5nfE9iamVjdH0gVVJMIHRvIE1ldGVvciBhcHAsXG4vLyAgIG9yIGFuIG9iamVjdCBhcyBhIHRlc3QgaG9vayAoc2VlIGNvZGUpXG4vLyBPcHRpb25zOlxuLy8gICByZWxvYWRXaXRoT3V0c3RhbmRpbmc6IGlzIGl0IE9LIHRvIHJlbG9hZCBpZiB0aGVyZSBhcmUgb3V0c3RhbmRpbmcgbWV0aG9kcz9cbi8vICAgaGVhZGVyczogZXh0cmEgaGVhZGVycyB0byBzZW5kIG9uIHRoZSB3ZWJzb2NrZXRzIGNvbm5lY3Rpb24sIGZvclxuLy8gICAgIHNlcnZlci10by1zZXJ2ZXIgRERQIG9ubHlcbi8vICAgX3NvY2tqc09wdGlvbnM6IFNwZWNpZmllcyBvcHRpb25zIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgc29ja2pzIGNsaWVudFxuLy8gICBvbkREUE5lZ290aWF0aW9uVmVyc2lvbkZhaWx1cmU6IGNhbGxiYWNrIHdoZW4gdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlscy5cbi8vXG4vLyBYWFggVGhlcmUgc2hvdWxkIGJlIGEgd2F5IHRvIGRlc3Ryb3kgYSBERFAgY29ubmVjdGlvbiwgY2F1c2luZyBhbGxcbi8vIG91dHN0YW5kaW5nIG1ldGhvZCBjYWxscyB0byBmYWlsLlxuLy9cbi8vIFhYWCBPdXIgY3VycmVudCB3YXkgb2YgaGFuZGxpbmcgZmFpbHVyZSBhbmQgcmVjb25uZWN0aW9uIGlzIGdyZWF0XG4vLyBmb3IgYW4gYXBwICh3aGVyZSB3ZSB3YW50IHRvIHRvbGVyYXRlIGJlaW5nIGRpc2Nvbm5lY3RlZCBhcyBhblxuLy8gZXhwZWN0IHN0YXRlLCBhbmQga2VlcCB0cnlpbmcgZm9yZXZlciB0byByZWNvbm5lY3QpIGJ1dCBjdW1iZXJzb21lXG4vLyBmb3Igc29tZXRoaW5nIGxpa2UgYSBjb21tYW5kIGxpbmUgdG9vbCB0aGF0IHdhbnRzIHRvIG1ha2UgYVxuLy8gY29ubmVjdGlvbiwgY2FsbCBhIG1ldGhvZCwgYW5kIHByaW50IGFuIGVycm9yIGlmIGNvbm5lY3Rpb25cbi8vIGZhaWxzLiBXZSBzaG91bGQgaGF2ZSBiZXR0ZXIgdXNhYmlsaXR5IGluIHRoZSBsYXR0ZXIgY2FzZSAod2hpbGVcbi8vIHN0aWxsIHRyYW5zcGFyZW50bHkgcmVjb25uZWN0aW5nIGlmIGl0J3MganVzdCBhIHRyYW5zaWVudCBmYWlsdXJlXG4vLyBvciB0aGUgc2VydmVyIG1pZ3JhdGluZyB1cykuXG5leHBvcnQgY2xhc3MgQ29ubmVjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHVybCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSB7XG4gICAgICBvbkNvbm5lY3RlZCgpIHt9LFxuICAgICAgb25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoZGVzY3JpcHRpb24pO1xuICAgICAgfSxcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNzUwMCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgICAgbnBtRmF5ZU9wdGlvbnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAvLyBUaGVzZSBvcHRpb25zIGFyZSBvbmx5IGZvciB0ZXN0aW5nLlxuICAgICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBmYWxzZSxcbiAgICAgIHN1cHBvcnRlZEREUFZlcnNpb25zOiBERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyxcbiAgICAgIHJldHJ5OiB0cnVlLFxuICAgICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgICAvLyBXaGVuIHVwZGF0ZXMgYXJlIGNvbWluZyB3aXRoaW4gdGhpcyBtcyBpbnRlcnZhbCwgYmF0Y2ggdGhlbSB0b2dldGhlci5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw6IDUsXG4gICAgICAvLyBGbHVzaCBidWZmZXJzIGltbWVkaWF0ZWx5IGlmIHdyaXRlcyBhcmUgaGFwcGVuaW5nIGNvbnRpbnVvdXNseSBmb3IgbW9yZSB0aGFuIHRoaXMgbWFueSBtcy5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzTWF4QWdlOiA1MDAsXG5cbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9O1xuXG4gICAgLy8gSWYgc2V0LCBjYWxsZWQgd2hlbiB3ZSByZWNvbm5lY3QsIHF1ZXVpbmcgbWV0aG9kIGNhbGxzIF9iZWZvcmVfIHRoZVxuICAgIC8vIGV4aXN0aW5nIG91dHN0YW5kaW5nIG9uZXMuXG4gICAgLy8gTk9URTogVGhpcyBmZWF0dXJlIGhhcyBiZWVuIHByZXNlcnZlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuIFRoZVxuICAgIC8vIHByZWZlcnJlZCBtZXRob2Qgb2Ygc2V0dGluZyBhIGNhbGxiYWNrIG9uIHJlY29ubmVjdCBpcyB0byB1c2VcbiAgICAvLyBERFAub25SZWNvbm5lY3QuXG4gICAgc2VsZi5vblJlY29ubmVjdCA9IG51bGw7XG5cbiAgICAvLyBhcyBhIHRlc3QgaG9vaywgYWxsb3cgcGFzc2luZyBhIHN0cmVhbSBpbnN0ZWFkIG9mIGEgdXJsLlxuICAgIGlmICh0eXBlb2YgdXJsID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VsZi5fc3RyZWFtID0gdXJsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IENsaWVudFN0cmVhbSB9ID0gcmVxdWlyZShcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiKTtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IG5ldyBDbGllbnRTdHJlYW0odXJsLCB7XG4gICAgICAgIHJldHJ5OiBvcHRpb25zLnJldHJ5LFxuICAgICAgICBDb25uZWN0aW9uRXJyb3I6IEREUC5Db25uZWN0aW9uRXJyb3IsXG4gICAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgICAgX3NvY2tqc09wdGlvbnM6IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMsXG4gICAgICAgIC8vIFVzZWQgdG8ga2VlcCBzb21lIHRlc3RzIHF1aWV0LCBvciBmb3Igb3RoZXIgY2FzZXMgaW4gd2hpY2hcbiAgICAgICAgLy8gdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdpdGggY29ubmVjdGlvbiBlcnJvcnMgaXMgdG8gc2lsZW50bHlcbiAgICAgICAgLy8gZmFpbCAoZS5nLiBzZW5kaW5nIHBhY2thZ2UgdXNhZ2Ugc3RhdHMpLiBBdCBzb21lIHBvaW50IHdlXG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGEgcmVhbCBBUEkgZm9yIGhhbmRsaW5nIGNsaWVudC1zdHJlYW0tbGV2ZWxcbiAgICAgICAgLy8gZXJyb3JzLlxuICAgICAgICBfZG9udFByaW50RXJyb3JzOiBvcHRpb25zLl9kb250UHJpbnRFcnJvcnMsXG4gICAgICAgIGNvbm5lY3RUaW1lb3V0TXM6IG9wdGlvbnMuY29ubmVjdFRpbWVvdXRNcyxcbiAgICAgICAgbnBtRmF5ZU9wdGlvbnM6IG9wdGlvbnMubnBtRmF5ZU9wdGlvbnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBudWxsO1xuICAgIHNlbGYuX3ZlcnNpb25TdWdnZXN0aW9uID0gbnVsbDsgLy8gVGhlIGxhc3QgcHJvcG9zZWQgRERQIHZlcnNpb24uXG4gICAgc2VsZi5fdmVyc2lvbiA9IG51bGw7IC8vIFRoZSBERFAgdmVyc2lvbiBhZ3JlZWQgb24gYnkgY2xpZW50IGFuZCBzZXJ2ZXIuXG4gICAgc2VsZi5fc3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBvYmplY3Qgd2l0aCBtZXRob2RzXG4gICAgc2VsZi5fbWV0aG9kSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBuYW1lIC0+IGZ1bmNcbiAgICBzZWxmLl9uZXh0TWV0aG9kSWQgPSAxO1xuICAgIHNlbGYuX3N1cHBvcnRlZEREUFZlcnNpb25zID0gb3B0aW9ucy5zdXBwb3J0ZWRERFBWZXJzaW9ucztcblxuICAgIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsID0gb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbDtcbiAgICBzZWxmLl9oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuXG4gICAgLy8gVHJhY2tzIG1ldGhvZHMgd2hpY2ggdGhlIHVzZXIgaGFzIHRyaWVkIHRvIGNhbGwgYnV0IHdoaWNoIGhhdmUgbm90IHlldFxuICAgIC8vIGNhbGxlZCB0aGVpciB1c2VyIGNhbGxiYWNrIChpZSwgdGhleSBhcmUgd2FpdGluZyBvbiB0aGVpciByZXN1bHQgb3IgZm9yIGFsbFxuICAgIC8vIG9mIHRoZWlyIHdyaXRlcyB0byBiZSB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZSkuIE1hcCBmcm9tIG1ldGhvZCBJRCB0b1xuICAgIC8vIE1ldGhvZEludm9rZXIgb2JqZWN0LlxuICAgIHNlbGYuX21ldGhvZEludm9rZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyBjYWxsZWQgYnV0IHdob3NlIHJlc3VsdCBtZXNzYWdlcyBoYXZlIG5vdFxuICAgIC8vIGFycml2ZWQgeWV0LlxuICAgIC8vXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIGlzIGFuIGFycmF5IG9mIGJsb2NrcyBvZiBtZXRob2RzLiBFYWNoIGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyBhIHNldCBvZiBtZXRob2RzIHRoYXQgY2FuIHJ1biBhdCB0aGUgc2FtZSB0aW1lLiBUaGUgZmlyc3QgYmxvY2tcbiAgICAvLyByZXByZXNlbnRzIHRoZSBtZXRob2RzIHdoaWNoIGFyZSBjdXJyZW50bHkgaW4gZmxpZ2h0OyBzdWJzZXF1ZW50IGJsb2Nrc1xuICAgIC8vIG11c3Qgd2FpdCBmb3IgcHJldmlvdXMgYmxvY2tzIHRvIGJlIGZ1bGx5IGZpbmlzaGVkIGJlZm9yZSB0aGV5IGNhbiBiZSBzZW50XG4gICAgLy8gdG8gdGhlIHNlcnZlci5cbiAgICAvL1xuICAgIC8vIEVhY2ggYmxvY2sgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gICAgLy8gLSBtZXRob2RzOiBhIGxpc3Qgb2YgTWV0aG9kSW52b2tlciBvYmplY3RzXG4gICAgLy8gLSB3YWl0OiBhIGJvb2xlYW47IGlmIHRydWUsIHRoaXMgYmxvY2sgaGFkIGEgc2luZ2xlIG1ldGhvZCBpbnZva2VkIHdpdGhcbiAgICAvLyAgICAgICAgIHRoZSBcIndhaXRcIiBvcHRpb25cbiAgICAvL1xuICAgIC8vIFRoZXJlIHdpbGwgbmV2ZXIgYmUgYWRqYWNlbnQgYmxvY2tzIHdpdGggd2FpdD1mYWxzZSwgYmVjYXVzZSB0aGUgb25seSB0aGluZ1xuICAgIC8vIHRoYXQgbWFrZXMgbWV0aG9kcyBuZWVkIHRvIGJlIHNlcmlhbGl6ZWQgaXMgYSB3YWl0IG1ldGhvZC5cbiAgICAvL1xuICAgIC8vIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZmlyc3QgYmxvY2sgd2hlbiB0aGVpciBcInJlc3VsdFwiIGlzXG4gICAgLy8gcmVjZWl2ZWQuIFRoZSBlbnRpcmUgZmlyc3QgYmxvY2sgaXMgb25seSByZW1vdmVkIHdoZW4gYWxsIG9mIHRoZSBpbi1mbGlnaHRcbiAgICAvLyBtZXRob2RzIGhhdmUgcmVjZWl2ZWQgdGhlaXIgcmVzdWx0cyAoc28gdGhlIFwibWV0aG9kc1wiIGxpc3QgaXMgZW1wdHkpICpBTkQqXG4gICAgLy8gYWxsIG9mIHRoZSBkYXRhIHdyaXR0ZW4gYnkgdGhvc2UgbWV0aG9kcyBhcmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIFNvXG4gICAgLy8gaXQgaXMgcG9zc2libGUgZm9yIHRoZSBmaXJzdCBibG9jaydzIG1ldGhvZHMgbGlzdCB0byBiZSBlbXB0eSwgaWYgd2UgYXJlXG4gICAgLy8gc3RpbGwgd2FpdGluZyBmb3Igc29tZSBvYmplY3RzIHRvIHF1aWVzY2UuXG4gICAgLy9cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vICBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbXX0sXG4gICAgLy8gICAge3dhaXQ6IHRydWUsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2xvZ2luJz5dfSxcbiAgICAvLyAgICB7d2FpdDogZmFsc2UsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2Zvbyc+LFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxNZXRob2RJbnZva2VyIGZvciAnYmFyJz5dfV1cbiAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgd2VyZSBzb21lIG1ldGhvZHMgd2hpY2ggd2VyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgYW5kXG4gICAgLy8gd2hpY2ggaGF2ZSByZXR1cm5lZCB0aGVpciByZXN1bHRzLCBidXQgc29tZSBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5XG4gICAgLy8gdGhlIG1ldGhvZHMgbWF5IG5vdCBiZSB2aXNpYmxlIGluIHRoZSBsb2NhbCBjYWNoZS4gT25jZSBhbGwgdGhhdCBkYXRhIGlzXG4gICAgLy8gdmlzaWJsZSwgd2Ugd2lsbCBzZW5kIGEgJ2xvZ2luJyBtZXRob2QuIE9uY2UgdGhlIGxvZ2luIG1ldGhvZCBoYXMgcmV0dXJuZWRcbiAgICAvLyBhbmQgYWxsIHRoZSBkYXRhIGlzIHZpc2libGUgKGluY2x1ZGluZyByZS1ydW5uaW5nIHN1YnMgaWYgdXNlcklkIGNoYW5nZXMpLFxuICAgIC8vIHdlIHdpbGwgc2VuZCB0aGUgJ2ZvbycgYW5kICdiYXInIG1ldGhvZHMgaW4gcGFyYWxsZWwuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIC8vIG1ldGhvZCBJRCAtPiBhcnJheSBvZiBvYmplY3RzIHdpdGgga2V5cyAnY29sbGVjdGlvbicgYW5kICdpZCcsIGxpc3RpbmdcbiAgICAvLyBkb2N1bWVudHMgd3JpdHRlbiBieSBhIGdpdmVuIG1ldGhvZCdzIHN0dWIuIGtleXMgYXJlIGFzc29jaWF0ZWQgd2l0aFxuICAgIC8vIG1ldGhvZHMgd2hvc2Ugc3R1YiB3cm90ZSBhdCBsZWFzdCBvbmUgZG9jdW1lbnQsIGFuZCB3aG9zZSBkYXRhLWRvbmUgbWVzc2FnZVxuICAgIC8vIGhhcyBub3QgeWV0IGJlZW4gcmVjZWl2ZWQuXG4gICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgLy8gY29sbGVjdGlvbiAtPiBJZE1hcCBvZiBcInNlcnZlciBkb2N1bWVudFwiIG9iamVjdC4gQSBcInNlcnZlciBkb2N1bWVudFwiIGhhczpcbiAgICAvLyAtIFwiZG9jdW1lbnRcIjogdGhlIHZlcnNpb24gb2YgdGhlIGRvY3VtZW50IGFjY29yZGluZyB0aGVcbiAgICAvLyAgIHNlcnZlciAoaWUsIHRoZSBzbmFwc2hvdCBiZWZvcmUgYSBzdHViIHdyb3RlIGl0LCBhbWVuZGVkIGJ5IGFueSBjaGFuZ2VzXG4gICAgLy8gICByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIpXG4gICAgLy8gICBJdCBpcyB1bmRlZmluZWQgaWYgd2UgdGhpbmsgdGhlIGRvY3VtZW50IGRvZXMgbm90IGV4aXN0XG4gICAgLy8gLSBcIndyaXR0ZW5CeVN0dWJzXCI6IGEgc2V0IG9mIG1ldGhvZCBJRHMgd2hvc2Ugc3R1YnMgd3JvdGUgdG8gdGhlIGRvY3VtZW50XG4gICAgLy8gICB3aG9zZSBcImRhdGEgZG9uZVwiIG1lc3NhZ2VzIGhhdmUgbm90IHlldCBiZWVuIHByb2Nlc3NlZFxuICAgIHNlbGYuX3NlcnZlckRvY3VtZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBBcnJheSBvZiBjYWxsYmFja3MgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBuZXh0IHVwZGF0ZSBvZiB0aGUgbG9jYWxcbiAgICAvLyBjYWNoZS4gVXNlZCBmb3I6XG4gICAgLy8gIC0gQ2FsbGluZyBtZXRob2RJbnZva2VyLmRhdGFWaXNpYmxlIGFuZCBzdWIgcmVhZHkgY2FsbGJhY2tzIGFmdGVyXG4gICAgLy8gICAgdGhlIHJlbGV2YW50IGRhdGEgaXMgZmx1c2hlZC5cbiAgICAvLyAgLSBJbnZva2luZyB0aGUgY2FsbGJhY2tzIG9mIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgYWZ0ZXIgcmVjb25uZWN0XG4gICAgLy8gICAgcXVpZXNjZW5jZS4gU3BlY2lmaWNhbGx5LCBtZXRob2RzIHdob3NlIHJlc3VsdCB3YXMgcmVjZWl2ZWQgb3ZlciB0aGUgb2xkXG4gICAgLy8gICAgY29ubmVjdGlvbiAoc28gd2UgZG9uJ3QgcmUtc2VuZCBpdCkgYnV0IHdob3NlIGRhdGEgaGFkIG5vdCBiZWVuIG1hZGVcbiAgICAvLyAgICB2aXNpYmxlLlxuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG5cbiAgICAvLyBJbiB0d28gY29udGV4dHMsIHdlIGJ1ZmZlciBhbGwgaW5jb21pbmcgZGF0YSBtZXNzYWdlcyBhbmQgdGhlbiBwcm9jZXNzIHRoZW1cbiAgICAvLyBhbGwgYXQgb25jZSBpbiBhIHNpbmdsZSB1cGRhdGU6XG4gICAgLy8gICAtIER1cmluZyByZWNvbm5lY3QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlcyB1bnRpbCBhbGwgc3VicyB0aGF0IGhhZFxuICAgIC8vICAgICBiZWVuIHJlYWR5IGJlZm9yZSByZWNvbm5lY3QgYXJlIHJlYWR5IGFnYWluLCBhbmQgYWxsIG1ldGhvZHMgdGhhdCBhcmVcbiAgICAvLyAgICAgYWN0aXZlIGhhdmUgcmV0dXJuZWQgdGhlaXIgXCJkYXRhIGRvbmUgbWVzc2FnZVwiOyB0aGVuXG4gICAgLy8gICAtIER1cmluZyB0aGUgZXhlY3V0aW9uIG9mIGEgXCJ3YWl0XCIgbWV0aG9kLCB3ZSBidWZmZXIgYWxsIGRhdGEgbWVzc2FnZXNcbiAgICAvLyAgICAgdW50aWwgdGhlIHdhaXQgbWV0aG9kIGdldHMgaXRzIFwiZGF0YSBkb25lXCIgbWVzc2FnZS4gKElmIHRoZSB3YWl0IG1ldGhvZFxuICAgIC8vICAgICBvY2N1cnMgZHVyaW5nIHJlY29ubmVjdCwgaXQgZG9lc24ndCBnZXQgYW55IHNwZWNpYWwgaGFuZGxpbmcuKVxuICAgIC8vIGFsbCBkYXRhIG1lc3NhZ2VzIGFyZSBwcm9jZXNzZWQgaW4gb25lIHVwZGF0ZS5cbiAgICAvL1xuICAgIC8vIFRoZSBmb2xsb3dpbmcgZmllbGRzIGFyZSB1c2VkIGZvciB0aGlzIFwicXVpZXNjZW5jZVwiIHByb2Nlc3MuXG5cbiAgICAvLyBUaGlzIGJ1ZmZlcnMgdGhlIG1lc3NhZ2VzIHRoYXQgYXJlbid0IGJlaW5nIHByb2Nlc3NlZCB5ZXQuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuICAgIC8vIE1hcCBmcm9tIG1ldGhvZCBJRCAtPiB0cnVlLiBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhpcyB3aGVuIHRoZWlyXG4gICAgLy8gXCJkYXRhIGRvbmVcIiBtZXNzYWdlIGlzIHJlY2VpdmVkLCBhbmQgd2Ugd2lsbCBub3QgcXVpZXNjZSB1bnRpbCBpdCBpc1xuICAgIC8vIGVtcHR5LlxuICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIC8vIG1hcCBmcm9tIHN1YiBJRCAtPiB0cnVlIGZvciBzdWJzIHRoYXQgd2VyZSByZWFkeSAoaWUsIGNhbGxlZCB0aGUgc3ViXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGJlZm9yZSByZWNvbm5lY3QgYnV0IGhhdmVuJ3QgYmVjb21lIHJlYWR5IGFnYWluIHlldFxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBtYXAgZnJvbSBzdWIuX2lkIC0+IHRydWVcbiAgICAvLyBpZiB0cnVlLCB0aGUgbmV4dCBkYXRhIHVwZGF0ZSBzaG91bGQgcmVzZXQgYWxsIHN0b3Jlcy4gKHNldCBkdXJpbmdcbiAgICAvLyByZWNvbm5lY3QuKVxuICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG5cbiAgICAvLyBuYW1lIC0+IGFycmF5IG9mIHVwZGF0ZXMgZm9yICh5ZXQgdG8gYmUgY3JlYXRlZCkgY29sbGVjdGlvbnNcbiAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgLy8gaWYgd2UncmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHRoZSByZXRyeSBmdW5jXG4gICAgc2VsZi5fcmV0cnlNaWdyYXRlID0gbnVsbDtcblxuICAgIHNlbGYuX19mbHVzaEJ1ZmZlcmVkV3JpdGVzID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgIHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMsXG4gICAgICAnZmx1c2hpbmcgRERQIGJ1ZmZlcmVkIHdyaXRlcycsXG4gICAgICBzZWxmXG4gICAgKTtcbiAgICAvLyBDb2xsZWN0aW9uIG5hbWUgLT4gYXJyYXkgb2YgbWVzc2FnZXMuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIC8vIFdoZW4gY3VycmVudCBidWZmZXIgb2YgdXBkYXRlcyBtdXN0IGJlIGZsdXNoZWQgYXQsIGluIG1zIHRpbWVzdGFtcC5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFRpbWVvdXQgaGFuZGxlIGZvciB0aGUgbmV4dCBwcm9jZXNzaW5nIG9mIGFsbCBwZW5kaW5nIHdyaXRlc1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDtcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZSA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG5cbiAgICAvLyBtZXRhZGF0YSBmb3Igc3Vic2NyaXB0aW9ucy4gIE1hcCBmcm9tIHN1YiBJRCB0byBvYmplY3Qgd2l0aCBrZXlzOlxuICAgIC8vICAgLSBpZFxuICAgIC8vICAgLSBuYW1lXG4gICAgLy8gICAtIHBhcmFtc1xuICAgIC8vICAgLSBpbmFjdGl2ZSAoaWYgdHJ1ZSwgd2lsbCBiZSBjbGVhbmVkIHVwIGlmIG5vdCByZXVzZWQgaW4gcmUtcnVuKVxuICAgIC8vICAgLSByZWFkeSAoaGFzIHRoZSAncmVhZHknIG1lc3NhZ2UgYmVlbiByZWNlaXZlZD8pXG4gICAgLy8gICAtIHJlYWR5Q2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiByZWFkeSlcbiAgICAvLyAgIC0gZXJyb3JDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCBpZiB0aGUgc3ViIHRlcm1pbmF0ZXMgd2l0aFxuICAgIC8vICAgICAgICAgICAgICAgICAgICBhbiBlcnJvciwgWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEpXG4gICAgLy8gICAtIHN0b3BDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCB3aGVuIHRoZSBzdWIgdGVybWluYXRlc1xuICAgIC8vICAgICBmb3IgYW55IHJlYXNvbiwgd2l0aCBhbiBlcnJvciBhcmd1bWVudCBpZiBhbiBlcnJvciB0cmlnZ2VyZWQgdGhlIHN0b3ApXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBSZWFjdGl2ZSB1c2VySWQuXG4gICAgc2VsZi5fdXNlcklkID0gbnVsbDtcbiAgICBzZWxmLl91c2VySWREZXBzID0gbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuXG4gICAgLy8gQmxvY2sgYXV0by1yZWxvYWQgd2hpbGUgd2UncmUgd2FpdGluZyBmb3IgbWV0aG9kIHJlc3BvbnNlcy5cbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50ICYmXG4gICAgICAgIFBhY2thZ2UucmVsb2FkICYmXG4gICAgICAgICEgb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcpIHtcbiAgICAgIFBhY2thZ2UucmVsb2FkLlJlbG9hZC5fb25NaWdyYXRlKHJldHJ5ID0+IHtcbiAgICAgICAgaWYgKCEgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgICAgIGlmIChzZWxmLl9yZXRyeU1pZ3JhdGUpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1R3byBtaWdyYXRpb25zIGluIHByb2dyZXNzPycpO1xuICAgICAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IHJldHJ5O1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gW3RydWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgb25EaXNjb25uZWN0ID0gKCkgPT4ge1xuICAgICAgaWYgKHNlbGYuX2hlYXJ0YmVhdCkge1xuICAgICAgICBzZWxmLl9oZWFydGJlYXQuc3RvcCgpO1xuICAgICAgICBzZWxmLl9oZWFydGJlYXQgPSBudWxsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdtZXNzYWdlJyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgICB0aGlzLm9uTWVzc2FnZS5iaW5kKHRoaXMpLFxuICAgICAgICAgICdoYW5kbGluZyBERFAgbWVzc2FnZSdcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ3Jlc2V0JyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCh0aGlzLm9uUmVzZXQuYmluZCh0aGlzKSwgJ2hhbmRsaW5nIEREUCByZXNldCcpXG4gICAgICApO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAnZGlzY29ubmVjdCcsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQob25EaXNjb25uZWN0LCAnaGFuZGxpbmcgRERQIGRpc2Nvbm5lY3QnKVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKCdtZXNzYWdlJywgdGhpcy5vbk1lc3NhZ2UuYmluZCh0aGlzKSk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ3Jlc2V0JywgdGhpcy5vblJlc2V0LmJpbmQodGhpcykpO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKCdkaXNjb25uZWN0Jywgb25EaXNjb25uZWN0KTtcbiAgICB9XG4gIH1cblxuICAvLyAnbmFtZScgaXMgdGhlIG5hbWUgb2YgdGhlIGRhdGEgb24gdGhlIHdpcmUgdGhhdCBzaG91bGQgZ28gaW4gdGhlXG4gIC8vIHN0b3JlLiAnd3JhcHBlZFN0b3JlJyBzaG91bGQgYmUgYW4gb2JqZWN0IHdpdGggbWV0aG9kcyBiZWdpblVwZGF0ZSwgdXBkYXRlLFxuICAvLyBlbmRVcGRhdGUsIHNhdmVPcmlnaW5hbHMsIHJldHJpZXZlT3JpZ2luYWxzLiBzZWUgQ29sbGVjdGlvbiBmb3IgYW4gZXhhbXBsZS5cbiAgcmVnaXN0ZXJTdG9yZShuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAobmFtZSBpbiBzZWxmLl9zdG9yZXMpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFdyYXAgdGhlIGlucHV0IG9iamVjdCBpbiBhbiBvYmplY3Qgd2hpY2ggbWFrZXMgYW55IHN0b3JlIG1ldGhvZCBub3RcbiAgICAvLyBpbXBsZW1lbnRlZCBieSAnc3RvcmUnIGludG8gYSBuby1vcC5cbiAgICB2YXIgc3RvcmUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIFsgJ3VwZGF0ZScsXG4gICAgICAnYmVnaW5VcGRhdGUnLFxuICAgICAgJ2VuZFVwZGF0ZScsXG4gICAgICAnc2F2ZU9yaWdpbmFscycsXG4gICAgICAncmV0cmlldmVPcmlnaW5hbHMnLFxuICAgICAgJ2dldERvYycsXG4gICAgICAnX2dldENvbGxlY3Rpb24nXG4gICAgXS5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gICAgICBzdG9yZVttZXRob2RdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgaWYgKHdyYXBwZWRTdG9yZVttZXRob2RdKSB7XG4gICAgICAgICAgcmV0dXJuIHdyYXBwZWRTdG9yZVttZXRob2RdKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgc2VsZi5fc3RvcmVzW25hbWVdID0gc3RvcmU7XG5cbiAgICB2YXIgcXVldWVkID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgaWYgKHF1ZXVlZCkge1xuICAgICAgc3RvcmUuYmVnaW5VcGRhdGUocXVldWVkLmxlbmd0aCwgZmFsc2UpO1xuICAgICAgcXVldWVkLmZvckVhY2gobXNnID0+IHtcbiAgICAgICAgc3RvcmUudXBkYXRlKG1zZyk7XG4gICAgICB9KTtcbiAgICAgIHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgZGVsZXRlIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN1YnNjcmliZVxuICAgKiBAc3VtbWFyeSBTdWJzY3JpYmUgdG8gYSByZWNvcmQgc2V0LiAgUmV0dXJucyBhIGhhbmRsZSB0aGF0IHByb3ZpZGVzXG4gICAqIGBzdG9wKClgIGFuZCBgcmVhZHkoKWAgbWV0aG9kcy5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBzdWJzY3JpcHRpb24uICBNYXRjaGVzIHRoZSBuYW1lIG9mIHRoZVxuICAgKiBzZXJ2ZXIncyBgcHVibGlzaCgpYCBjYWxsLlxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXJcbiAgICogZnVuY3Rpb24gb24gc2VydmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdH0gW2NhbGxiYWNrc10gT3B0aW9uYWwuIE1heSBpbmNsdWRlIGBvblN0b3BgXG4gICAqIGFuZCBgb25SZWFkeWAgY2FsbGJhY2tzLiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgaXQgaXMgcGFzc2VkIGFzIGFuXG4gICAqIGFyZ3VtZW50IHRvIGBvblN0b3BgLiBJZiBhIGZ1bmN0aW9uIGlzIHBhc3NlZCBpbnN0ZWFkIG9mIGFuIG9iamVjdCwgaXRcbiAgICogaXMgaW50ZXJwcmV0ZWQgYXMgYW4gYG9uUmVhZHlgIGNhbGxiYWNrLlxuICAgKi9cbiAgc3Vic2NyaWJlKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKGNhbGxiYWNrfGNhbGxiYWNrcykgKi8pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgcGFyYW1zID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBjYWxsYmFja3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGlmIChwYXJhbXMubGVuZ3RoKSB7XG4gICAgICB2YXIgbGFzdFBhcmFtID0gcGFyYW1zW3BhcmFtcy5sZW5ndGggLSAxXTtcbiAgICAgIGlmICh0eXBlb2YgbGFzdFBhcmFtID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrcy5vblJlYWR5ID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfSBlbHNlIGlmIChsYXN0UGFyYW0gJiYgW1xuICAgICAgICBsYXN0UGFyYW0ub25SZWFkeSxcbiAgICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgb25FcnJvciB1c2VkIHRvIGV4aXN0LCBidXQgbm93IHdlIHVzZVxuICAgICAgICAvLyBvblN0b3Agd2l0aCBhbiBlcnJvciBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgICBsYXN0UGFyYW0ub25FcnJvcixcbiAgICAgICAgbGFzdFBhcmFtLm9uU3RvcFxuICAgICAgXS5zb21lKGYgPT4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIikpIHtcbiAgICAgICAgY2FsbGJhY2tzID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElzIHRoZXJlIGFuIGV4aXN0aW5nIHN1YiB3aXRoIHRoZSBzYW1lIG5hbWUgYW5kIHBhcmFtLCBydW4gaW4gYW5cbiAgICAvLyBpbnZhbGlkYXRlZCBDb21wdXRhdGlvbj8gVGhpcyB3aWxsIGhhcHBlbiBpZiB3ZSBhcmUgcmVydW5uaW5nIGFuXG4gICAgLy8gZXhpc3RpbmcgY29tcHV0YXRpb24uXG4gICAgLy9cbiAgICAvLyBGb3IgZXhhbXBsZSwgY29uc2lkZXIgYSByZXJ1biBvZjpcbiAgICAvL1xuICAgIC8vICAgICBUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJmb29cIiwgU2Vzc2lvbi5nZXQoXCJmb29cIikpO1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJiYXJcIiwgU2Vzc2lvbi5nZXQoXCJiYXJcIikpO1xuICAgIC8vICAgICB9KTtcbiAgICAvL1xuICAgIC8vIElmIFwiZm9vXCIgaGFzIGNoYW5nZWQgYnV0IFwiYmFyXCIgaGFzIG5vdCwgd2Ugd2lsbCBtYXRjaCB0aGUgXCJiYXJcIlxuICAgIC8vIHN1YmNyaWJlIHRvIGFuIGV4aXN0aW5nIGluYWN0aXZlIHN1YnNjcmlwdGlvbiBpbiBvcmRlciB0byBub3RcbiAgICAvLyB1bnN1YiBhbmQgcmVzdWIgdGhlIHN1YnNjcmlwdGlvbiB1bm5lY2Vzc2FyaWx5LlxuICAgIC8vXG4gICAgLy8gV2Ugb25seSBsb29rIGZvciBvbmUgc3VjaCBzdWI7IGlmIHRoZXJlIGFyZSBOIGFwcGFyZW50bHktaWRlbnRpY2FsIHN1YnNcbiAgICAvLyBiZWluZyBpbnZhbGlkYXRlZCwgd2Ugd2lsbCByZXF1aXJlIE4gbWF0Y2hpbmcgc3Vic2NyaWJlIGNhbGxzIHRvIGtlZXBcbiAgICAvLyB0aGVtIGFsbCBhY3RpdmUuXG4gICAgdmFyIGV4aXN0aW5nO1xuICAgIGtleXMoc2VsZi5fc3Vic2NyaXB0aW9ucykuc29tZShpZCA9PiB7XG4gICAgICBjb25zdCBzdWIgPSBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXTtcbiAgICAgIGlmIChzdWIuaW5hY3RpdmUgJiZcbiAgICAgICAgICBzdWIubmFtZSA9PT0gbmFtZSAmJlxuICAgICAgICAgIEVKU09OLmVxdWFscyhzdWIucGFyYW1zLCBwYXJhbXMpKSB7XG4gICAgICAgIHJldHVybiBleGlzdGluZyA9IHN1YjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHZhciBpZDtcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGlkID0gZXhpc3RpbmcuaWQ7XG4gICAgICBleGlzdGluZy5pbmFjdGl2ZSA9IGZhbHNlOyAvLyByZWFjdGl2YXRlXG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25SZWFkeSkge1xuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIG5vdCBhbHJlYWR5IHJlYWR5LCByZXBsYWNlIGFueSByZWFkeSBjYWxsYmFjayB3aXRoIHRoZVxuICAgICAgICAvLyBvbmUgcHJvdmlkZWQgbm93LiAoSXQncyBub3QgcmVhbGx5IGNsZWFyIHdoYXQgdXNlcnMgd291bGQgZXhwZWN0IGZvclxuICAgICAgICAvLyBhbiBvblJlYWR5IGNhbGxiYWNrIGluc2lkZSBhbiBhdXRvcnVuOyB0aGUgc2VtYW50aWNzIHdlIHByb3ZpZGUgaXNcbiAgICAgICAgLy8gdGhhdCBhdCB0aGUgdGltZSB0aGUgc3ViIGZpcnN0IGJlY29tZXMgcmVhZHksIHdlIGNhbGwgdGhlIGxhc3RcbiAgICAgICAgLy8gb25SZWFkeSBjYWxsYmFjayBwcm92aWRlZCwgaWYgYW55LilcbiAgICAgICAgLy8gSWYgdGhlIHN1YiBpcyBhbHJlYWR5IHJlYWR5LCBydW4gdGhlIHJlYWR5IGNhbGxiYWNrIHJpZ2h0IGF3YXkuXG4gICAgICAgIC8vIEl0IHNlZW1zIHRoYXQgdXNlcnMgd291bGQgZXhwZWN0IGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuXG4gICAgICAgIC8vIGF1dG9ydW4gdG8gdHJpZ2dlciBvbmNlIHRoZSB0aGUgc3ViIGZpcnN0IGJlY29tZXMgcmVhZHkgYW5kIGFsc29cbiAgICAgICAgLy8gd2hlbiByZS1zdWJzIGhhcHBlbnMuXG4gICAgICAgIGlmIChleGlzdGluZy5yZWFkeSkge1xuICAgICAgICAgIGNhbGxiYWNrcy5vblJlYWR5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhpc3RpbmcucmVhZHlDYWxsYmFjayA9IGNhbGxiYWNrcy5vblJlYWR5O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xIHdlIHVzZWQgdG8gaGF2ZSBvbkVycm9yIGJ1dCBub3cgd2UgY2FsbFxuICAgICAgLy8gb25TdG9wIHdpdGggYW4gb3B0aW9uYWwgZXJyb3IgYXJndW1lbnRcbiAgICAgIGlmIChjYWxsYmFja3Mub25FcnJvcikge1xuICAgICAgICAvLyBSZXBsYWNlIGV4aXN0aW5nIGNhbGxiYWNrIGlmIGFueSwgc28gdGhhdCBlcnJvcnMgYXJlbid0XG4gICAgICAgIC8vIGRvdWJsZS1yZXBvcnRlZC5cbiAgICAgICAgZXhpc3RpbmcuZXJyb3JDYWxsYmFjayA9IGNhbGxiYWNrcy5vbkVycm9yO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2FsbGJhY2tzLm9uU3RvcCkge1xuICAgICAgICBleGlzdGluZy5zdG9wQ2FsbGJhY2sgPSBjYWxsYmFja3Mub25TdG9wO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOZXcgc3ViISBHZW5lcmF0ZSBhbiBpZCwgc2F2ZSBpdCBsb2NhbGx5LCBhbmQgc2VuZCBtZXNzYWdlLlxuICAgICAgaWQgPSBSYW5kb20uaWQoKTtcbiAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdID0ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHBhcmFtczogRUpTT04uY2xvbmUocGFyYW1zKSxcbiAgICAgICAgaW5hY3RpdmU6IGZhbHNlLFxuICAgICAgICByZWFkeTogZmFsc2UsXG4gICAgICAgIHJlYWR5RGVwczogbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpLFxuICAgICAgICByZWFkeUNhbGxiYWNrOiBjYWxsYmFja3Mub25SZWFkeSxcbiAgICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICAgICAgZXJyb3JDYWxsYmFjazogY2FsbGJhY2tzLm9uRXJyb3IsXG4gICAgICAgIHN0b3BDYWxsYmFjazogY2FsbGJhY2tzLm9uU3RvcCxcbiAgICAgICAgY29ubmVjdGlvbjogc2VsZixcbiAgICAgICAgcmVtb3ZlKCkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb24uX3N1YnNjcmlwdGlvbnNbdGhpcy5pZF07XG4gICAgICAgICAgdGhpcy5yZWFkeSAmJiB0aGlzLnJlYWR5RGVwcy5jaGFuZ2VkKCk7XG4gICAgICAgIH0sXG4gICAgICAgIHN0b3AoKSB7XG4gICAgICAgICAgdGhpcy5jb25uZWN0aW9uLl9zZW5kKHsgbXNnOiAndW5zdWInLCBpZDogaWQgfSk7XG4gICAgICAgICAgdGhpcy5yZW1vdmUoKTtcblxuICAgICAgICAgIGlmIChjYWxsYmFja3Mub25TdG9wKSB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25TdG9wKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2VsZi5fc2VuZCh7IG1zZzogJ3N1YicsIGlkOiBpZCwgbmFtZTogbmFtZSwgcGFyYW1zOiBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGEgaGFuZGxlIHRvIHRoZSBhcHBsaWNhdGlvbi5cbiAgICB2YXIgaGFuZGxlID0ge1xuICAgICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLnN0b3AoKTtcbiAgICAgIH0sXG4gICAgICByZWFkeSgpIHtcbiAgICAgICAgLy8gcmV0dXJuIGZhbHNlIGlmIHdlJ3ZlIHVuc3Vic2NyaWJlZC5cbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZWNvcmQgPSBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXTtcbiAgICAgICAgcmVjb3JkLnJlYWR5RGVwcy5kZXBlbmQoKTtcbiAgICAgICAgcmV0dXJuIHJlY29yZC5yZWFkeTtcbiAgICAgIH0sXG4gICAgICBzdWJzY3JpcHRpb25JZDogaWRcbiAgICB9O1xuXG4gICAgaWYgKFRyYWNrZXIuYWN0aXZlKSB7XG4gICAgICAvLyBXZSdyZSBpbiBhIHJlYWN0aXZlIGNvbXB1dGF0aW9uLCBzbyB3ZSdkIGxpa2UgdG8gdW5zdWJzY3JpYmUgd2hlbiB0aGVcbiAgICAgIC8vIGNvbXB1dGF0aW9uIGlzIGludmFsaWRhdGVkLi4uIGJ1dCBub3QgaWYgdGhlIHJlcnVuIGp1c3QgcmUtc3Vic2NyaWJlc1xuICAgICAgLy8gdG8gdGhlIHNhbWUgc3Vic2NyaXB0aW9uISAgV2hlbiBhIHJlcnVuIGhhcHBlbnMsIHdlIHVzZSBvbkludmFsaWRhdGVcbiAgICAgIC8vIGFzIGEgY2hhbmdlIHRvIG1hcmsgdGhlIHN1YnNjcmlwdGlvbiBcImluYWN0aXZlXCIgc28gdGhhdCBpdCBjYW5cbiAgICAgIC8vIGJlIHJldXNlZCBmcm9tIHRoZSByZXJ1bi4gIElmIGl0IGlzbid0IHJldXNlZCwgaXQncyBraWxsZWQgZnJvbVxuICAgICAgLy8gYW4gYWZ0ZXJGbHVzaC5cbiAgICAgIFRyYWNrZXIub25JbnZhbGlkYXRlKGMgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0uaW5hY3RpdmUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgVHJhY2tlci5hZnRlckZsdXNoKCgpID0+IHtcbiAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpICYmXG4gICAgICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlKSB7XG4gICAgICAgICAgICBoYW5kbGUuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgLy8gb3B0aW9uczpcbiAgLy8gLSBvbkxhdGVFcnJvciB7RnVuY3Rpb24oZXJyb3IpfSBjYWxsZWQgaWYgYW4gZXJyb3Igd2FzIHJlY2VpdmVkIGFmdGVyIHRoZSByZWFkeSBldmVudC5cbiAgLy8gICAgIChlcnJvcnMgcmVjZWl2ZWQgYmVmb3JlIHJlYWR5IGNhdXNlIGFuIGVycm9yIHRvIGJlIHRocm93bilcbiAgX3N1YnNjcmliZUFuZFdhaXQobmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZiA9IG5ldyBGdXR1cmUoKTtcbiAgICB2YXIgcmVhZHkgPSBmYWxzZTtcbiAgICB2YXIgaGFuZGxlO1xuICAgIGFyZ3MgPSBhcmdzIHx8IFtdO1xuICAgIGFyZ3MucHVzaCh7XG4gICAgICBvblJlYWR5KCkge1xuICAgICAgICByZWFkeSA9IHRydWU7XG4gICAgICAgIGZbJ3JldHVybiddKCk7XG4gICAgICB9LFxuICAgICAgb25FcnJvcihlKSB7XG4gICAgICAgIGlmICghcmVhZHkpIGZbJ3Rocm93J10oZSk7XG4gICAgICAgIGVsc2Ugb3B0aW9ucyAmJiBvcHRpb25zLm9uTGF0ZUVycm9yICYmIG9wdGlvbnMub25MYXRlRXJyb3IoZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBoYW5kbGUgPSBzZWxmLnN1YnNjcmliZS5hcHBseShzZWxmLCBbbmFtZV0uY29uY2F0KGFyZ3MpKTtcbiAgICBmLndhaXQoKTtcbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgbWV0aG9kcyhtZXRob2RzKSB7XG4gICAga2V5cyhtZXRob2RzKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgY29uc3QgZnVuYyA9IG1ldGhvZHNbbmFtZV07XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdcIiArIG5hbWUgKyBcIicgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX21ldGhvZEhhbmRsZXJzW25hbWVdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmNhbGxcbiAgICogQHN1bW1hcnkgSW52b2tlcyBhIG1ldGhvZCBwYXNzaW5nIGFueSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBtZXRob2QgYXJndW1lbnRzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFthc3luY0NhbGxiYWNrXSBPcHRpb25hbCBjYWxsYmFjaywgd2hpY2ggaXMgY2FsbGVkIGFzeW5jaHJvbm91c2x5IHdpdGggdGhlIGVycm9yIG9yIHJlc3VsdCBhZnRlciB0aGUgbWV0aG9kIGlzIGNvbXBsZXRlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBtZXRob2QgcnVucyBzeW5jaHJvbm91c2x5IGlmIHBvc3NpYmxlIChzZWUgYmVsb3cpLlxuICAgKi9cbiAgY2FsbChuYW1lIC8qIC4uIFthcmd1bWVudHNdIC4uIGNhbGxiYWNrICovKSB7XG4gICAgLy8gaWYgaXQncyBhIGZ1bmN0aW9uLCB0aGUgbGFzdCBhcmd1bWVudCBpcyB0aGUgcmVzdWx0IGNhbGxiYWNrLFxuICAgIC8vIG5vdCBhIHBhcmFtZXRlciB0byB0aGUgcmVtb3RlIG1ldGhvZC5cbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBpZiAoYXJncy5sZW5ndGggJiYgdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgcmV0dXJuIHRoaXMuYXBwbHkobmFtZSwgYXJncywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmFwcGx5XG4gICAqIEBzdW1tYXJ5IEludm9rZSBhIG1ldGhvZCBwYXNzaW5nIGFuIGFycmF5IG9mIGFyZ3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICAgKiBAcGFyYW0ge0VKU09OYWJsZVtdfSBhcmdzIE1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMud2FpdCAoQ2xpZW50IG9ubHkpIElmIHRydWUsIGRvbid0IHNlbmQgdGhpcyBtZXRob2QgdW50aWwgYWxsIHByZXZpb3VzIG1ldGhvZCBjYWxscyBoYXZlIGNvbXBsZXRlZCwgYW5kIGRvbid0IHNlbmQgYW55IHN1YnNlcXVlbnQgbWV0aG9kIGNhbGxzIHVudGlsIHRoaXMgb25lIGlzIGNvbXBsZXRlZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy5vblJlc3VsdFJlY2VpdmVkIChDbGllbnQgb25seSkgVGhpcyBjYWxsYmFjayBpcyBpbnZva2VkIHdpdGggdGhlIGVycm9yIG9yIHJlc3VsdCBvZiB0aGUgbWV0aG9kIChqdXN0IGxpa2UgYGFzeW5jQ2FsbGJhY2tgKSBhcyBzb29uIGFzIHRoZSBlcnJvciBvciByZXN1bHQgaXMgYXZhaWxhYmxlLiBUaGUgbG9jYWwgY2FjaGUgbWF5IG5vdCB5ZXQgcmVmbGVjdCB0aGUgd3JpdGVzIHBlcmZvcm1lZCBieSB0aGUgbWV0aG9kLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubm9SZXRyeSAoQ2xpZW50IG9ubHkpIGlmIHRydWUsIGRvbid0IHNlbmQgdGhpcyBtZXRob2QgYWdhaW4gb24gcmVsb2FkLCBzaW1wbHkgY2FsbCB0aGUgY2FsbGJhY2sgYW4gZXJyb3Igd2l0aCB0aGUgZXJyb3IgY29kZSAnaW52b2NhdGlvbi1mYWlsZWQnLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudGhyb3dTdHViRXhjZXB0aW9ucyAoQ2xpZW50IG9ubHkpIElmIHRydWUsIGV4Y2VwdGlvbnMgdGhyb3duIGJ5IG1ldGhvZCBzdHVicyB3aWxsIGJlIHRocm93biBpbnN0ZWFkIG9mIGxvZ2dlZCwgYW5kIHRoZSBtZXRob2Qgd2lsbCBub3QgYmUgaW52b2tlZCBvbiB0aGUgc2VydmVyLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlIChDbGllbnQgb25seSkgSWYgdHJ1ZSB0aGVuIGluIGNhc2VzIHdoZXJlIHdlIHdvdWxkIGhhdmUgb3RoZXJ3aXNlIGRpc2NhcmRlZCB0aGUgc3R1YidzIHJldHVybiB2YWx1ZSBhbmQgcmV0dXJuZWQgdW5kZWZpbmVkLCBpbnN0ZWFkIHdlIGdvIGFoZWFkIGFuZCByZXR1cm4gaXQuIFNwZWNpZmljYWxseSwgdGhpcyBpcyBhbnkgdGltZSBvdGhlciB0aGFuIHdoZW4gKGEpIHdlIGFyZSBhbHJlYWR5IGluc2lkZSBhIHN0dWIgb3IgKGIpIHdlIGFyZSBpbiBOb2RlIGFuZCBubyBjYWxsYmFjayB3YXMgcHJvdmlkZWQuIEN1cnJlbnRseSB3ZSByZXF1aXJlIHRoaXMgZmxhZyB0byBiZSBleHBsaWNpdGx5IHBhc3NlZCB0byByZWR1Y2UgdGhlIGxpa2VsaWhvb2QgdGhhdCBzdHViIHJldHVybiB2YWx1ZXMgd2lsbCBiZSBjb25mdXNlZCB3aXRoIHNlcnZlciByZXR1cm4gdmFsdWVzOyB3ZSBtYXkgaW1wcm92ZSB0aGlzIGluIGZ1dHVyZS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrOyBzYW1lIHNlbWFudGljcyBhcyBpbiBbYE1ldGVvci5jYWxsYF0oI21ldGVvcl9jYWxsKS5cbiAgICovXG4gIGFwcGx5KG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIC8vIFhYWCB3b3VsZCBpdCBiZSBiZXR0ZXIgZm9ybSB0byBkbyB0aGUgYmluZGluZyBpbiBzdHJlYW0ub24sXG4gICAgICAvLyBvciBjYWxsZXIsIGluc3RlYWQgb2YgaGVyZT9cbiAgICAgIC8vIFhYWCBpbXByb3ZlIGVycm9yIG1lc3NhZ2UgKGFuZCBob3cgd2UgcmVwb3J0IGl0KVxuICAgICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgXCJkZWxpdmVyaW5nIHJlc3VsdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gS2VlcCBvdXIgYXJncyBzYWZlIGZyb20gbXV0YXRpb24gKGVnIGlmIHdlIGRvbid0IHNlbmQgdGhlIG1lc3NhZ2UgZm9yIGFcbiAgICAvLyB3aGlsZSBiZWNhdXNlIG9mIGEgd2FpdCBtZXRob2QpLlxuICAgIGFyZ3MgPSBFSlNPTi5jbG9uZShhcmdzKTtcblxuICAgIHZhciBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgIHZhciBhbHJlYWR5SW5TaW11bGF0aW9uID0gZW5jbG9zaW5nICYmIGVuY2xvc2luZy5pc1NpbXVsYXRpb247XG5cbiAgICAvLyBMYXppbHkgZ2VuZXJhdGUgYSByYW5kb21TZWVkLCBvbmx5IGlmIGl0IGlzIHJlcXVlc3RlZCBieSB0aGUgc3R1Yi5cbiAgICAvLyBUaGUgcmFuZG9tIHN0cmVhbXMgb25seSBoYXZlIHV0aWxpdHkgaWYgdGhleSdyZSB1c2VkIG9uIGJvdGggdGhlIGNsaWVudFxuICAgIC8vIGFuZCB0aGUgc2VydmVyOyBpZiB0aGUgY2xpZW50IGRvZXNuJ3QgZ2VuZXJhdGUgYW55ICdyYW5kb20nIHZhbHVlc1xuICAgIC8vIHRoZW4gd2UgZG9uJ3QgZXhwZWN0IHRoZSBzZXJ2ZXIgdG8gZ2VuZXJhdGUgYW55IGVpdGhlci5cbiAgICAvLyBMZXNzIGNvbW1vbmx5LCB0aGUgc2VydmVyIG1heSBwZXJmb3JtIGRpZmZlcmVudCBhY3Rpb25zIGZyb20gdGhlIGNsaWVudCxcbiAgICAvLyBhbmQgbWF5IGluIGZhY3QgZ2VuZXJhdGUgdmFsdWVzIHdoZXJlIHRoZSBjbGllbnQgZGlkIG5vdCwgYnV0IHdlIGRvbid0XG4gICAgLy8gaGF2ZSBhbnkgY2xpZW50LXNpZGUgdmFsdWVzIHRvIG1hdGNoLCBzbyBldmVuIGhlcmUgd2UgbWF5IGFzIHdlbGwganVzdFxuICAgIC8vIHVzZSBhIHJhbmRvbSBzZWVkIG9uIHRoZSBzZXJ2ZXIuICBJbiB0aGF0IGNhc2UsIHdlIGRvbid0IHBhc3MgdGhlXG4gICAgLy8gcmFuZG9tU2VlZCB0byBzYXZlIGJhbmR3aWR0aCwgYW5kIHdlIGRvbid0IGV2ZW4gZ2VuZXJhdGUgaXQgdG8gc2F2ZSBhXG4gICAgLy8gYml0IG9mIENQVSBhbmQgdG8gYXZvaWQgY29uc3VtaW5nIGVudHJvcHkuXG4gICAgdmFyIHJhbmRvbVNlZWQgPSBudWxsO1xuICAgIHZhciByYW5kb21TZWVkR2VuZXJhdG9yID0gKCkgPT4ge1xuICAgICAgaWYgKHJhbmRvbVNlZWQgPT09IG51bGwpIHtcbiAgICAgICAgcmFuZG9tU2VlZCA9IEREUENvbW1vbi5tYWtlUnBjU2VlZChlbmNsb3NpbmcsIG5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJhbmRvbVNlZWQ7XG4gICAgfTtcblxuICAgIC8vIFJ1biB0aGUgc3R1YiwgaWYgd2UgaGF2ZSBvbmUuIFRoZSBzdHViIGlzIHN1cHBvc2VkIHRvIG1ha2Ugc29tZVxuICAgIC8vIHRlbXBvcmFyeSB3cml0ZXMgdG8gdGhlIGRhdGFiYXNlIHRvIGdpdmUgdGhlIHVzZXIgYSBzbW9vdGggZXhwZXJpZW5jZVxuICAgIC8vIHVudGlsIHRoZSBhY3R1YWwgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGUgbWV0aG9kIGNvbWVzIGJhY2sgZnJvbSB0aGVcbiAgICAvLyBzZXJ2ZXIgKHdoZXJldXBvbiB0aGUgdGVtcG9yYXJ5IHdyaXRlcyB0byB0aGUgZGF0YWJhc2Ugd2lsbCBiZSByZXZlcnNlZFxuICAgIC8vIGR1cmluZyB0aGUgYmVnaW5VcGRhdGUvZW5kVXBkYXRlIHByb2Nlc3MuKVxuICAgIC8vXG4gICAgLy8gTm9ybWFsbHksIHdlIGlnbm9yZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBzdHViIChldmVuIGlmIGl0IGlzIGFuXG4gICAgLy8gZXhjZXB0aW9uKSwgaW4gZmF2b3Igb2YgdGhlIHJlYWwgcmV0dXJuIHZhbHVlIGZyb20gdGhlIHNlcnZlci4gVGhlXG4gICAgLy8gZXhjZXB0aW9uIGlzIGlmIHRoZSAqY2FsbGVyKiBpcyBhIHN0dWIuIEluIHRoYXQgY2FzZSwgd2UncmUgbm90IGdvaW5nXG4gICAgLy8gdG8gZG8gYSBSUEMsIHNvIHdlIHVzZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBzdHViIGFzIG91ciByZXR1cm5cbiAgICAvLyB2YWx1ZS5cblxuICAgIHZhciBzdHViID0gc2VsZi5fbWV0aG9kSGFuZGxlcnNbbmFtZV07XG4gICAgaWYgKHN0dWIpIHtcbiAgICAgIHZhciBzZXRVc2VySWQgPSB1c2VySWQgPT4ge1xuICAgICAgICBzZWxmLnNldFVzZXJJZCh1c2VySWQpO1xuICAgICAgfTtcblxuICAgICAgdmFyIGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgICBpc1NpbXVsYXRpb246IHRydWUsXG4gICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQoKSxcbiAgICAgICAgc2V0VXNlcklkOiBzZXRVc2VySWQsXG4gICAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgICAgcmV0dXJuIHJhbmRvbVNlZWRHZW5lcmF0b3IoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmICghYWxyZWFkeUluU2ltdWxhdGlvbikgc2VsZi5fc2F2ZU9yaWdpbmFscygpO1xuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgICAgICAvLyB0aGF0IHN0dWJzIGNoZWNrKCkgdGhlaXIgYXJndW1lbnRzLlxuICAgICAgICB2YXIgc3R1YlJldHVyblZhbHVlID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gICAgICAgICAgICAgIC8vIEJlY2F1c2Ugc2F2ZU9yaWdpbmFscyBhbmQgcmV0cmlldmVPcmlnaW5hbHMgYXJlbid0IHJlZW50cmFudCxcbiAgICAgICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gcmUtY2xvbmUsIHNvIHRoYXQgdGhlIHN0dWIgY2FuJ3QgYWZmZWN0IG91ciBjYWxsZXIncyB2YWx1ZXNcbiAgICAgICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdmFyIGV4Y2VwdGlvbiA9IGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgd2UncmUgaW4gYSBzaW11bGF0aW9uLCBzdG9wIGFuZCByZXR1cm4gdGhlIHJlc3VsdCB3ZSBoYXZlLFxuICAgIC8vIHJhdGhlciB0aGFuIGdvaW5nIG9uIHRvIGRvIGFuIFJQQy4gSWYgdGhlcmUgd2FzIG5vIHN0dWIsXG4gICAgLy8gd2UnbGwgZW5kIHVwIHJldHVybmluZyB1bmRlZmluZWQuXG4gICAgaWYgKGFscmVhZHlJblNpbXVsYXRpb24pIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhleGNlcHRpb24sIHN0dWJSZXR1cm5WYWx1ZSk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZXhjZXB0aW9uKSB0aHJvdyBleGNlcHRpb247XG4gICAgICByZXR1cm4gc3R1YlJldHVyblZhbHVlO1xuICAgIH1cblxuICAgIC8vIFdlIG9ubHkgY3JlYXRlIHRoZSBtZXRob2RJZCBoZXJlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgbmVlZCBvbmUgaWZcbiAgICAvLyB3ZSdyZSBhbHJlYWR5IGluIGEgc2ltdWxhdGlvblxuICAgIGNvbnN0IG1ldGhvZElkID0gJycgKyBzZWxmLl9uZXh0TWV0aG9kSWQrKztcbiAgICBpZiAoc3R1Yikge1xuICAgICAgc2VsZi5fcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyhtZXRob2RJZCk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgdGhlIEREUCBtZXNzYWdlIGZvciB0aGUgbWV0aG9kIGNhbGwuIE5vdGUgdGhhdCBvbiB0aGUgY2xpZW50LFxuICAgIC8vIGl0IGlzIGltcG9ydGFudCB0aGF0IHRoZSBzdHViIGhhdmUgZmluaXNoZWQgYmVmb3JlIHdlIHNlbmQgdGhlIFJQQywgc29cbiAgICAvLyB0aGF0IHdlIGtub3cgd2UgaGF2ZSBhIGNvbXBsZXRlIGxpc3Qgb2Ygd2hpY2ggbG9jYWwgZG9jdW1lbnRzIHRoZSBzdHViXG4gICAgLy8gd3JvdGUuXG4gICAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgICBtc2c6ICdtZXRob2QnLFxuICAgICAgbWV0aG9kOiBuYW1lLFxuICAgICAgcGFyYW1zOiBhcmdzLFxuICAgICAgaWQ6IG1ldGhvZElkXG4gICAgfTtcblxuICAgIC8vIElmIGFuIGV4Y2VwdGlvbiBvY2N1cnJlZCBpbiBhIHN0dWIsIGFuZCB3ZSdyZSBpZ25vcmluZyBpdFxuICAgIC8vIGJlY2F1c2Ugd2UncmUgZG9pbmcgYW4gUlBDIGFuZCB3YW50IHRvIHVzZSB3aGF0IHRoZSBzZXJ2ZXJcbiAgICAvLyByZXR1cm5zIGluc3RlYWQsIGxvZyBpdCBzbyB0aGUgZGV2ZWxvcGVyIGtub3dzXG4gICAgLy8gKHVubGVzcyB0aGV5IGV4cGxpY2l0bHkgYXNrIHRvIHNlZSB0aGUgZXJyb3IpLlxuICAgIC8vXG4gICAgLy8gVGVzdHMgY2FuIHNldCB0aGUgJ19leHBlY3RlZEJ5VGVzdCcgZmxhZyBvbiBhbiBleGNlcHRpb24gc28gaXQgd29uJ3RcbiAgICAvLyBnbyB0byBsb2cuXG4gICAgaWYgKGV4Y2VwdGlvbikge1xuICAgICAgaWYgKG9wdGlvbnMudGhyb3dTdHViRXhjZXB0aW9ucykge1xuICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICB9IGVsc2UgaWYgKCFleGNlcHRpb24uX2V4cGVjdGVkQnlUZXN0KSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXG4gICAgICAgICAgXCJFeGNlcHRpb24gd2hpbGUgc2ltdWxhdGluZyB0aGUgZWZmZWN0IG9mIGludm9raW5nICdcIiArIG5hbWUgKyBcIidcIixcbiAgICAgICAgICBleGNlcHRpb25cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlJ3JlIGRlZmluaXRlbHkgZG9pbmcgYW4gUlBDLCBhbmQgd2UncmUgZ29pbmcgdG9cbiAgICAvLyByZXR1cm4gdGhlIHZhbHVlIG9mIHRoZSBSUEMgdG8gdGhlIGNhbGxlci5cblxuICAgIC8vIElmIHRoZSBjYWxsZXIgZGlkbid0IGdpdmUgYSBjYWxsYmFjaywgZGVjaWRlIHdoYXQgdG8gZG8uXG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgICAvLyBPbiB0aGUgY2xpZW50LCB3ZSBkb24ndCBoYXZlIGZpYmVycywgc28gd2UgY2FuJ3QgYmxvY2suIFRoZVxuICAgICAgICAvLyBvbmx5IHRoaW5nIHdlIGNhbiBkbyBpcyB0byByZXR1cm4gdW5kZWZpbmVkIGFuZCBkaXNjYXJkIHRoZVxuICAgICAgICAvLyByZXN1bHQgb2YgdGhlIFJQQy4gSWYgYW4gZXJyb3Igb2NjdXJyZWQgdGhlbiBwcmludCB0aGUgZXJyb3JcbiAgICAgICAgLy8gdG8gdGhlIGNvbnNvbGUuXG4gICAgICAgIGNhbGxiYWNrID0gZXJyID0+IHtcbiAgICAgICAgICBlcnIgJiYgTWV0ZW9yLl9kZWJ1ZyhcIkVycm9yIGludm9raW5nIE1ldGhvZCAnXCIgKyBuYW1lICsgXCInXCIsIGVycik7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBPbiB0aGUgc2VydmVyLCBtYWtlIHRoZSBmdW5jdGlvbiBzeW5jaHJvbm91cy4gVGhyb3cgb25cbiAgICAgICAgLy8gZXJyb3JzLCByZXR1cm4gb24gc3VjY2Vzcy5cbiAgICAgICAgdmFyIGZ1dHVyZSA9IG5ldyBGdXR1cmUoKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdXR1cmUucmVzb2x2ZXIoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZW5kIHRoZSByYW5kb21TZWVkIG9ubHkgaWYgd2UgdXNlZCBpdFxuICAgIGlmIChyYW5kb21TZWVkICE9PSBudWxsKSB7XG4gICAgICBtZXNzYWdlLnJhbmRvbVNlZWQgPSByYW5kb21TZWVkO1xuICAgIH1cblxuICAgIHZhciBtZXRob2RJbnZva2VyID0gbmV3IE1ldGhvZEludm9rZXIoe1xuICAgICAgbWV0aG9kSWQsXG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgb25SZXN1bHRSZWNlaXZlZDogb3B0aW9ucy5vblJlc3VsdFJlY2VpdmVkLFxuICAgICAgd2FpdDogISFvcHRpb25zLndhaXQsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgbm9SZXRyeTogISFvcHRpb25zLm5vUmV0cnlcbiAgICB9KTtcblxuICAgIGlmIChvcHRpb25zLndhaXQpIHtcbiAgICAgIC8vIEl0J3MgYSB3YWl0IG1ldGhvZCEgV2FpdCBtZXRob2RzIGdvIGluIHRoZWlyIG93biBibG9jay5cbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICB3YWl0OiB0cnVlLFxuICAgICAgICBtZXRob2RzOiBbbWV0aG9kSW52b2tlcl1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3QgYSB3YWl0IG1ldGhvZC4gU3RhcnQgYSBuZXcgYmxvY2sgaWYgdGhlIHByZXZpb3VzIGJsb2NrIHdhcyBhIHdhaXRcbiAgICAgIC8vIGJsb2NrLCBhbmQgYWRkIGl0IHRvIHRoZSBsYXN0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykgfHxcbiAgICAgICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0KSB7XG4gICAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICAgIHdhaXQ6IGZhbHNlLFxuICAgICAgICAgIG1ldGhvZHM6IFtdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG1ldGhvZEludm9rZXIpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGFkZGVkIGl0IHRvIHRoZSBmaXJzdCBibG9jaywgc2VuZCBpdCBvdXQgbm93LlxuICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIG1ldGhvZEludm9rZXIuc2VuZE1lc3NhZ2UoKTtcblxuICAgIC8vIElmIHdlJ3JlIHVzaW5nIHRoZSBkZWZhdWx0IGNhbGxiYWNrIG9uIHRoZSBzZXJ2ZXIsXG4gICAgLy8gYmxvY2sgd2FpdGluZyBmb3IgdGhlIHJlc3VsdC5cbiAgICBpZiAoZnV0dXJlKSB7XG4gICAgICByZXR1cm4gZnV0dXJlLndhaXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlID8gc3R1YlJldHVyblZhbHVlIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICBrZXlzKHRoaXMuX3N0b3JlcykuZm9yRWFjaChzdG9yZU5hbWUgPT4ge1xuICAgICAgdGhpcy5fc3RvcmVzW3N0b3JlTmFtZV0uc2F2ZU9yaWdpbmFscygpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gUmV0cmlldmVzIHRoZSBvcmlnaW5hbCB2ZXJzaW9ucyBvZiBhbGwgZG9jdW1lbnRzIG1vZGlmaWVkIGJ5IHRoZSBzdHViIGZvclxuICAvLyBtZXRob2QgJ21ldGhvZElkJyBmcm9tIGFsbCBzdG9yZXMgYW5kIHNhdmVzIHRoZW0gdG8gX3NlcnZlckRvY3VtZW50cyAoa2V5ZWRcbiAgLy8gYnkgZG9jdW1lbnQpIGFuZCBfZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiAoa2V5ZWQgYnkgbWV0aG9kIElEKS5cbiAgX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMobWV0aG9kSWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIHZhciBkb2NzV3JpdHRlbiA9IFtdO1xuXG4gICAga2V5cyhzZWxmLl9zdG9yZXMpLmZvckVhY2goY29sbGVjdGlvbiA9PiB7XG4gICAgICB2YXIgb3JpZ2luYWxzID0gc2VsZi5fc3RvcmVzW2NvbGxlY3Rpb25dLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgc2VydmVyRG9jID0gc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dLnNldERlZmF1bHQoXG4gICAgICAgICAgaWQsXG4gICAgICAgICAgT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgICAgICApO1xuICAgICAgICBpZiAoc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzKSB7XG4gICAgICAgICAgLy8gV2UncmUgbm90IHRoZSBmaXJzdCBzdHViIHRvIHdyaXRlIHRoaXMgZG9jLiBKdXN0IGFkZCBvdXIgbWV0aG9kIElEXG4gICAgICAgICAgLy8gdG8gdGhlIHJlY29yZC5cbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXJzdCBzdHViISBTYXZlIHRoZSBvcmlnaW5hbCB2YWx1ZSBhbmQgb3VyIG1ldGhvZCBJRC5cbiAgICAgICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBkb2M7XG4gICAgICAgICAgc2VydmVyRG9jLmZsdXNoQ2FsbGJhY2tzID0gW107XG4gICAgICAgICAgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKCEgaXNFbXB0eShkb2NzV3JpdHRlbikpIHtcbiAgICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdID0gZG9jc1dyaXR0ZW47XG4gICAgfVxuICB9XG5cbiAgLy8gVGhpcyBpcyB2ZXJ5IG11Y2ggYSBwcml2YXRlIGZ1bmN0aW9uIHdlIHVzZSB0byBtYWtlIHRoZSB0ZXN0c1xuICAvLyB0YWtlIHVwIGZld2VyIHNlcnZlciByZXNvdXJjZXMgYWZ0ZXIgdGhleSBjb21wbGV0ZS5cbiAgX3Vuc3Vic2NyaWJlQWxsKCkge1xuICAgIGtleXModGhpcy5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaChpZCA9PiB7XG4gICAgICBjb25zdCBzdWIgPSB0aGlzLl9zdWJzY3JpcHRpb25zW2lkXTtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIFdlIGRldGVjdGVkIHZpYSBERFAtbGV2ZWwgaGVhcnRiZWF0cyB0aGF0IHdlJ3ZlIGxvc3QgdGhlXG4gIC8vIGNvbm5lY3Rpb24uICBVbmxpa2UgYGRpc2Nvbm5lY3RgIG9yIGBjbG9zZWAsIGEgbG9zdCBjb25uZWN0aW9uXG4gIC8vIHdpbGwgYmUgYXV0b21hdGljYWxseSByZXRyaWVkLlxuICBfbG9zdENvbm5lY3Rpb24oZXJyb3IpIHtcbiAgICB0aGlzLl9zdHJlYW0uX2xvc3RDb25uZWN0aW9uKGVycm9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdGF0dXNcbiAgICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IGNvbm5lY3Rpb24gc3RhdHVzLiBBIHJlYWN0aXZlIGRhdGEgc291cmNlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBzdGF0dXMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uc3RhdHVzKC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZvcmNlIGFuIGltbWVkaWF0ZSByZWNvbm5lY3Rpb24gYXR0ZW1wdCBpZiB0aGUgY2xpZW50IGlzIG5vdCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlci5cblxuICBUaGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcgaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IucmVjb25uZWN0XG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHJlY29ubmVjdCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuZGlzY29ubmVjdFxuICAgKiBAc3VtbWFyeSBEaXNjb25uZWN0IHRoZSBjbGllbnQgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBkaXNjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlIH0pO1xuICB9XG5cbiAgLy8vXG4gIC8vLyBSZWFjdGl2ZSB1c2VyIHN5c3RlbVxuICAvLy9cbiAgdXNlcklkKCkge1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmRlcGVuZCgpO1xuICAgIHJldHVybiB0aGlzLl91c2VySWQ7XG4gIH1cblxuICBzZXRVc2VySWQodXNlcklkKSB7XG4gICAgLy8gQXZvaWQgaW52YWxpZGF0aW5nIGRlcGVuZGVudHMgaWYgc2V0VXNlcklkIGlzIGNhbGxlZCB3aXRoIGN1cnJlbnQgdmFsdWUuXG4gICAgaWYgKHRoaXMuX3VzZXJJZCA9PT0gdXNlcklkKSByZXR1cm47XG4gICAgdGhpcy5fdXNlcklkID0gdXNlcklkO1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmNoYW5nZWQoKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgaW4gYSBzdGF0ZSBhZnRlciByZWNvbm5lY3Qgb2Ygd2FpdGluZyBmb3Igc3VicyB0byBiZVxuICAvLyByZXZpdmVkIG9yIGVhcmx5IG1ldGhvZHMgdG8gZmluaXNoIHRoZWlyIGRhdGEsIG9yIHdlIGFyZSB3YWl0aW5nIGZvciBhXG4gIC8vIFwid2FpdFwiIG1ldGhvZCB0byBmaW5pc2guXG4gIF93YWl0aW5nRm9yUXVpZXNjZW5jZSgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgISBpc0VtcHR5KHRoaXMuX3N1YnNCZWluZ1Jldml2ZWQpIHx8XG4gICAgICAhIGlzRW1wdHkodGhpcy5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSlcbiAgICApO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIGFueSBtZXRob2Qgd2hvc2UgbWVzc2FnZSBoYXMgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIgaGFzXG4gIC8vIG5vdCB5ZXQgaW52b2tlZCBpdHMgdXNlciBjYWxsYmFjay5cbiAgX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpIHtcbiAgICBjb25zdCBpbnZva2VycyA9IHRoaXMuX21ldGhvZEludm9rZXJzO1xuICAgIHJldHVybiBrZXlzKGludm9rZXJzKS5zb21lKGlkID0+IHtcbiAgICAgIHJldHVybiBpbnZva2Vyc1tpZF0uc2VudE1lc3NhZ2U7XG4gICAgfSk7XG4gIH1cblxuICBfbGl2ZWRhdGFfY29ubmVjdGVkKG1zZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl92ZXJzaW9uICE9PSAncHJlMScgJiYgc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwgIT09IDApIHtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG5ldyBERFBDb21tb24uSGVhcnRiZWF0KHtcbiAgICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IHNlbGYuX2hlYXJ0YmVhdEludGVydmFsLFxuICAgICAgICBoZWFydGJlYXRUaW1lb3V0OiBzZWxmLl9oZWFydGJlYXRUaW1lb3V0LFxuICAgICAgICBvblRpbWVvdXQoKSB7XG4gICAgICAgICAgc2VsZi5fbG9zdENvbm5lY3Rpb24oXG4gICAgICAgICAgICBuZXcgRERQLkNvbm5lY3Rpb25FcnJvcignRERQIGhlYXJ0YmVhdCB0aW1lZCBvdXQnKVxuICAgICAgICAgICk7XG4gICAgICAgIH0sXG4gICAgICAgIHNlbmRQaW5nKCkge1xuICAgICAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdwaW5nJyB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzZWxmLl9oZWFydGJlYXQuc3RhcnQoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgcmVjb25uZWN0LCB3ZSdsbCBoYXZlIHRvIHJlc2V0IGFsbCBzdG9yZXMuXG4gICAgaWYgKHNlbGYuX2xhc3RTZXNzaW9uSWQpIHNlbGYuX3Jlc2V0U3RvcmVzID0gdHJ1ZTtcblxuICAgIGlmICh0eXBlb2YgbXNnLnNlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICB2YXIgcmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbiA9IHNlbGYuX2xhc3RTZXNzaW9uSWQgPT09IG1zZy5zZXNzaW9uO1xuICAgICAgc2VsZi5fbGFzdFNlc3Npb25JZCA9IG1zZy5zZXNzaW9uO1xuICAgIH1cblxuICAgIGlmIChyZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uKSB7XG4gICAgICAvLyBTdWNjZXNzZnVsIHJlY29ubmVjdGlvbiAtLSBwaWNrIHVwIHdoZXJlIHdlIGxlZnQgb2ZmLiAgTm90ZSB0aGF0IHJpZ2h0XG4gICAgICAvLyBub3csIHRoaXMgbmV2ZXIgaGFwcGVuczogdGhlIHNlcnZlciBuZXZlciBjb25uZWN0cyB1cyB0byBhIHByZXZpb3VzXG4gICAgICAvLyBzZXNzaW9uLCBiZWNhdXNlIEREUCBkb2Vzbid0IHByb3ZpZGUgZW5vdWdoIGRhdGEgZm9yIHRoZSBzZXJ2ZXIgdG8ga25vd1xuICAgICAgLy8gd2hhdCBtZXNzYWdlcyB0aGUgY2xpZW50IGhhcyBwcm9jZXNzZWQuIFdlIG5lZWQgdG8gaW1wcm92ZSBERFAgdG8gbWFrZVxuICAgICAgLy8gdGhpcyBwb3NzaWJsZSwgYXQgd2hpY2ggcG9pbnQgd2UnbGwgcHJvYmFibHkgbmVlZCBtb3JlIGNvZGUgaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXJ2ZXIgZG9lc24ndCBoYXZlIG91ciBkYXRhIGFueSBtb3JlLiBSZS1zeW5jIGEgbmV3IHNlc3Npb24uXG5cbiAgICAvLyBGb3JnZXQgYWJvdXQgbWVzc2FnZXMgd2Ugd2VyZSBidWZmZXJpbmcgZm9yIHVua25vd24gY29sbGVjdGlvbnMuIFRoZXknbGxcbiAgICAvLyBiZSByZXNlbnQgaWYgc3RpbGwgcmVsZXZhbnQuXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAvLyBGb3JnZXQgYWJvdXQgdGhlIGVmZmVjdHMgb2Ygc3R1YnMuIFdlJ2xsIGJlIHJlc2V0dGluZyBhbGwgY29sbGVjdGlvbnNcbiAgICAgIC8vIGFueXdheS5cbiAgICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBfYWZ0ZXJVcGRhdGVDYWxsYmFja3MuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIE1hcmsgYWxsIG5hbWVkIHN1YnNjcmlwdGlvbnMgd2hpY2ggYXJlIHJlYWR5IChpZSwgd2UgYWxyZWFkeSBjYWxsZWQgdGhlXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGFzIG5lZWRpbmcgdG8gYmUgcmV2aXZlZC5cbiAgICAvLyBYWFggV2Ugc2hvdWxkIGFsc28gYmxvY2sgcmVjb25uZWN0IHF1aWVzY2VuY2UgdW50aWwgdW5uYW1lZCBzdWJzY3JpcHRpb25zXG4gICAgLy8gICAgIChlZywgYXV0b3B1Ymxpc2gpIGFyZSBkb25lIHJlLXB1Ymxpc2hpbmcgdG8gYXZvaWQgZmxpY2tlciFcbiAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBrZXlzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgaWYgKHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLnJlYWR5KSB7XG4gICAgICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbaWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFycmFuZ2UgZm9yIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgdG8gaGF2ZSB0aGVpciBjYWxsYmFja3MgcnVuLCBhbmRcbiAgICAvLyB0cmFjayBtZXRob2RzIHRoYXQgd2VyZSBzZW50IG9uIHRoaXMgY29ubmVjdGlvbiBzbyB0aGF0IHdlIGRvbid0XG4gICAgLy8gcXVpZXNjZSB1bnRpbCB0aGV5IGFyZSBhbGwgZG9uZS5cbiAgICAvL1xuICAgIC8vIFN0YXJ0IGJ5IGNsZWFyaW5nIF9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlOiBtZXRob2RzIHNlbnQgYmVmb3JlXG4gICAgLy8gcmVjb25uZWN0IGRvbid0IG1hdHRlciwgYW5kIGFueSBcIndhaXRcIiBtZXRob2RzIHNlbnQgb24gdGhlIG5ldyBjb25uZWN0aW9uXG4gICAgLy8gdGhhdCB3ZSBkcm9wIGhlcmUgd2lsbCBiZSByZXN0b3JlZCBieSB0aGUgbG9vcCBiZWxvdy5cbiAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIGNvbnN0IGludm9rZXJzID0gc2VsZi5fbWV0aG9kSW52b2tlcnM7XG4gICAgICBrZXlzKGludm9rZXJzKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgICAgY29uc3QgaW52b2tlciA9IGludm9rZXJzW2lkXTtcbiAgICAgICAgaWYgKGludm9rZXIuZ290UmVzdWx0KCkpIHtcbiAgICAgICAgICAvLyBUaGlzIG1ldGhvZCBhbHJlYWR5IGdvdCBpdHMgcmVzdWx0LCBidXQgaXQgZGlkbid0IGNhbGwgaXRzIGNhbGxiYWNrXG4gICAgICAgICAgLy8gYmVjYXVzZSBpdHMgZGF0YSBkaWRuJ3QgYmVjb21lIHZpc2libGUuIFdlIGRpZCBub3QgcmVzZW5kIHRoZVxuICAgICAgICAgIC8vIG1ldGhvZCBSUEMuIFdlJ2xsIGNhbGwgaXRzIGNhbGxiYWNrIHdoZW4gd2UgZ2V0IGEgZnVsbCBxdWllc2NlLFxuICAgICAgICAgIC8vIHNpbmNlIHRoYXQncyBhcyBjbG9zZSBhcyB3ZSdsbCBnZXQgdG8gXCJkYXRhIG11c3QgYmUgdmlzaWJsZVwiLlxuICAgICAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goXG4gICAgICAgICAgICAoLi4uYXJncykgPT4gaW52b2tlci5kYXRhVmlzaWJsZSguLi5hcmdzKVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW52b2tlci5zZW50TWVzc2FnZSkge1xuICAgICAgICAgIC8vIFRoaXMgbWV0aG9kIGhhcyBiZWVuIHNlbnQgb24gdGhpcyBjb25uZWN0aW9uIChtYXliZSBhcyBhIHJlc2VuZFxuICAgICAgICAgIC8vIGZyb20gdGhlIGxhc3QgY29ubmVjdGlvbiwgbWF5YmUgZnJvbSBvblJlY29ubmVjdCwgbWF5YmUganVzdCB2ZXJ5XG4gICAgICAgICAgLy8gcXVpY2tseSBiZWZvcmUgcHJvY2Vzc2luZyB0aGUgY29ubmVjdGVkIG1lc3NhZ2UpLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZyBzcGVjaWFsIHRvIGVuc3VyZSBpdHMgY2FsbGJhY2tzIGdldFxuICAgICAgICAgIC8vIGNhbGxlZCwgYnV0IHdlJ2xsIGNvdW50IGl0IGFzIGEgbWV0aG9kIHdoaWNoIGlzIHByZXZlbnRpbmdcbiAgICAgICAgICAvLyByZWNvbm5lY3QgcXVpZXNjZW5jZS4gKGVnLCBpdCBtaWdodCBiZSBhIGxvZ2luIG1ldGhvZCB0aGF0IHdhcyBydW5cbiAgICAgICAgICAvLyBmcm9tIG9uUmVjb25uZWN0LCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBzZWUgZmxpY2tlciBieSBzZWVpbmcgYVxuICAgICAgICAgIC8vIGxvZ2dlZC1vdXQgc3RhdGUuKVxuICAgICAgICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbaW52b2tlci5tZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG5cbiAgICAvLyBJZiB3ZSdyZSBub3Qgd2FpdGluZyBvbiBhbnkgbWV0aG9kcyBvciBzdWJzLCB3ZSBjYW4gcmVzZXQgdGhlIHN0b3JlcyBhbmRcbiAgICAvLyBjYWxsIHRoZSBjYWxsYmFja3MgaW1tZWRpYXRlbHkuXG4gICAgaWYgKCEgc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIGtleXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKHN0b3JlTmFtZSA9PiB7XG4gICAgICAgICAgY29uc3QgcyA9IHNlbGYuX3N0b3Jlc1tzdG9yZU5hbWVdO1xuICAgICAgICAgIHMuYmVnaW5VcGRhdGUoMCwgdHJ1ZSk7XG4gICAgICAgICAgcy5lbmRVcGRhdGUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3QgbWVzc2FnZVR5cGUgPSBtc2cubXNnO1xuXG4gICAgLy8gbXNnIGlzIG9uZSBvZiBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ11cbiAgICBpZiAobWVzc2FnZVR5cGUgPT09ICdhZGRlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfYWRkZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAnY2hhbmdlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdyZW1vdmVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICd1cGRhdGVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc191cGRhdGVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ25vc3ViJykge1xuICAgICAgLy8gaWdub3JlIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIGRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfbGl2ZWRhdGFfZGF0YShtc2cpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZS5wdXNoKG1zZyk7XG5cbiAgICAgIGlmIChtc2cubXNnID09PSAnbm9zdWInKSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW21zZy5pZF07XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cuc3Vicykge1xuICAgICAgICBtc2cuc3Vicy5mb3JFYWNoKHN1YklkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFtzdWJJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAobXNnLm1ldGhvZHMpIHtcbiAgICAgICAgbXNnLm1ldGhvZHMuZm9yRWFjaChtZXRob2RJZCA9PiB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbbWV0aG9kSWRdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBObyBtZXRob2RzIG9yIHN1YnMgYXJlIGJsb2NraW5nIHF1aWVzY2VuY2UhXG4gICAgICAvLyBXZSdsbCBub3cgcHJvY2VzcyBhbmQgYWxsIG9mIG91ciBidWZmZXJlZCBtZXNzYWdlcywgcmVzZXQgYWxsIHN0b3JlcyxcbiAgICAgIC8vIGFuZCBhcHBseSB0aGVtIGFsbCBhdCBvbmNlLlxuXG4gICAgICBjb25zdCBidWZmZXJlZE1lc3NhZ2VzID0gc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZTtcbiAgICAgIGtleXMoYnVmZmVyZWRNZXNzYWdlcykuZm9yRWFjaChpZCA9PiB7XG4gICAgICAgIHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShcbiAgICAgICAgICBidWZmZXJlZE1lc3NhZ2VzW2lkXSxcbiAgICAgICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc1xuICAgICAgICApO1xuICAgICAgfSk7XG5cbiAgICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UgPSBbXTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCBzZWxmLl9idWZmZXJlZFdyaXRlcyk7XG4gICAgfVxuXG4gICAgLy8gSW1tZWRpYXRlbHkgZmx1c2ggd3JpdGVzIHdoZW46XG4gICAgLy8gIDEuIEJ1ZmZlcmluZyBpcyBkaXNhYmxlZC4gT3I7XG4gICAgLy8gIDIuIGFueSBub24tKGFkZGVkL2NoYW5nZWQvcmVtb3ZlZCkgbWVzc2FnZSBhcnJpdmVzLlxuICAgIHZhciBzdGFuZGFyZFdyaXRlID1cbiAgICAgIG1zZy5tc2cgPT09IFwiYWRkZWRcIiB8fFxuICAgICAgbXNnLm1zZyA9PT0gXCJjaGFuZ2VkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwicmVtb3ZlZFwiO1xuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPT09IDAgfHwgISBzdGFuZGFyZFdyaXRlKSB7XG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9PT0gbnVsbCkge1xuICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID1cbiAgICAgICAgbmV3IERhdGUoKS52YWx1ZU9mKCkgKyBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZTtcbiAgICB9IGVsc2UgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA8IG5ldyBEYXRlKCkudmFsdWVPZigpKSB7XG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICB9XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSA9IHNldFRpbWVvdXQoXG4gICAgICBzZWxmLl9fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWxcbiAgICApO1xuICB9XG5cbiAgX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFdlIG5lZWQgdG8gY2xlYXIgdGhlIGJ1ZmZlciBiZWZvcmUgcGFzc2luZyBpdCB0b1xuICAgIC8vICBwZXJmb3JtV3JpdGVzLiBBcyB0aGVyZSdzIG5vIGd1YXJhbnRlZSB0aGF0IGl0XG4gICAgLy8gIHdpbGwgZXhpdCBjbGVhbmx5LlxuICAgIHZhciB3cml0ZXMgPSBzZWxmLl9idWZmZXJlZFdyaXRlcztcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgc2VsZi5fcGVyZm9ybVdyaXRlcyh3cml0ZXMpO1xuICB9XG5cbiAgX3BlcmZvcm1Xcml0ZXModXBkYXRlcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3JlcyB8fCAhIGlzRW1wdHkodXBkYXRlcykpIHtcbiAgICAgIC8vIEJlZ2luIGEgdHJhbnNhY3Rpb25hbCB1cGRhdGUgb2YgZWFjaCBzdG9yZS5cblxuICAgICAga2V5cyhzZWxmLl9zdG9yZXMpLmZvckVhY2goc3RvcmVOYW1lID0+IHtcbiAgICAgICAgc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV0uYmVnaW5VcGRhdGUoXG4gICAgICAgICAgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKVxuICAgICAgICAgICAgPyB1cGRhdGVzW3N0b3JlTmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICA6IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICBrZXlzKHVwZGF0ZXMpLmZvckVhY2goc3RvcmVOYW1lID0+IHtcbiAgICAgICAgY29uc3QgdXBkYXRlTWVzc2FnZXMgPSB1cGRhdGVzW3N0b3JlTmFtZV07XG4gICAgICAgIHZhciBzdG9yZSA9IHNlbGYuX3N0b3Jlc1tzdG9yZU5hbWVdO1xuICAgICAgICBpZiAoc3RvcmUpIHtcbiAgICAgICAgICB1cGRhdGVNZXNzYWdlcy5mb3JFYWNoKHVwZGF0ZU1lc3NhZ2UgPT4ge1xuICAgICAgICAgICAgc3RvcmUudXBkYXRlKHVwZGF0ZU1lc3NhZ2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vYm9keSdzIGxpc3RlbmluZyBmb3IgdGhpcyBkYXRhLiBRdWV1ZSBpdCB1cCB1bnRpbFxuICAgICAgICAgIC8vIHNvbWVvbmUgd2FudHMgaXQuXG4gICAgICAgICAgLy8gWFhYIG1lbW9yeSB1c2Ugd2lsbCBncm93IHdpdGhvdXQgYm91bmQgaWYgeW91IGZvcmdldCB0b1xuICAgICAgICAgIC8vIGNyZWF0ZSBhIGNvbGxlY3Rpb24gb3IganVzdCBkb24ndCBjYXJlIGFib3V0IGl0Li4uIGdvaW5nXG4gICAgICAgICAgLy8gdG8gaGF2ZSB0byBkbyBzb21ldGhpbmcgYWJvdXQgdGhhdC5cbiAgICAgICAgICBjb25zdCB1cGRhdGVzID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXM7XG5cbiAgICAgICAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBzdG9yZU5hbWUpKSB7XG4gICAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0gPSBbXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0ucHVzaCguLi51cGRhdGVNZXNzYWdlcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBFbmQgdXBkYXRlIHRyYW5zYWN0aW9uLlxuICAgICAga2V5cyhzZWxmLl9zdG9yZXMpLmZvckVhY2goc3RvcmVOYW1lID0+IHtcbiAgICAgICAgc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV0uZW5kVXBkYXRlKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICB9XG5cbiAgLy8gQ2FsbCBhbnkgY2FsbGJhY2tzIGRlZmVycmVkIHdpdGggX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCB3aG9zZVxuICAvLyByZWxldmFudCBkb2NzIGhhdmUgYmVlbiBmbHVzaGVkLCBhcyB3ZWxsIGFzIGRhdGFWaXNpYmxlIGNhbGxiYWNrcyBhdFxuICAvLyByZWNvbm5lY3QtcXVpZXNjZW5jZSB0aW1lLlxuICBfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjYWxsYmFja3MgPSBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcztcbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKGMgPT4ge1xuICAgICAgYygpO1xuICAgIH0pO1xuICB9XG5cbiAgX3B1c2hVcGRhdGUodXBkYXRlcywgY29sbGVjdGlvbiwgbXNnKSB7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgY29sbGVjdGlvbikpIHtcbiAgICAgIHVwZGF0ZXNbY29sbGVjdGlvbl0gPSBbXTtcbiAgICB9XG4gICAgdXBkYXRlc1tjb2xsZWN0aW9uXS5wdXNoKG1zZyk7XG4gIH1cblxuICBfZ2V0U2VydmVyRG9jKGNvbGxlY3Rpb24sIGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3NlcnZlckRvY3VtZW50cywgY29sbGVjdGlvbikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB2YXIgc2VydmVyRG9jc0ZvckNvbGxlY3Rpb24gPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl07XG4gICAgcmV0dXJuIHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uLmdldChpZCkgfHwgbnVsbDtcbiAgfVxuXG4gIF9wcm9jZXNzX2FkZGVkKG1zZywgdXBkYXRlcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgaWQgPSBNb25nb0lELmlkUGFyc2UobXNnLmlkKTtcbiAgICB2YXIgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBpZCk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgLy8gU29tZSBvdXRzdGFuZGluZyBzdHViIHdyb3RlIGhlcmUuXG4gICAgICB2YXIgaXNFeGlzdGluZyA9IHNlcnZlckRvYy5kb2N1bWVudCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBtc2cuZmllbGRzIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQuX2lkID0gaWQ7XG5cbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICAvLyBEdXJpbmcgcmVjb25uZWN0IHRoZSBzZXJ2ZXIgaXMgc2VuZGluZyBhZGRzIGZvciBleGlzdGluZyBpZHMuXG4gICAgICAgIC8vIEFsd2F5cyBwdXNoIGFuIHVwZGF0ZSBzbyB0aGF0IGRvY3VtZW50IHN0YXlzIGluIHRoZSBzdG9yZSBhZnRlclxuICAgICAgICAvLyByZXNldC4gVXNlIGN1cnJlbnQgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQgZm9yIHRoaXMgdXBkYXRlLCBzb1xuICAgICAgICAvLyB0aGF0IHN0dWItd3JpdHRlbiB2YWx1ZXMgYXJlIHByZXNlcnZlZC5cbiAgICAgICAgdmFyIGN1cnJlbnREb2MgPSBzZWxmLl9zdG9yZXNbbXNnLmNvbGxlY3Rpb25dLmdldERvYyhtc2cuaWQpO1xuICAgICAgICBpZiAoY3VycmVudERvYyAhPT0gdW5kZWZpbmVkKSBtc2cuZmllbGRzID0gY3VycmVudERvYztcblxuICAgICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgICAgfSBlbHNlIGlmIChpc0V4aXN0aW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU2VydmVyIHNlbnQgYWRkIGZvciBleGlzdGluZyBpZDogJyArIG1zZy5pZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBjaGFuZ2VkIGZvciBub25leGlzdGluZyBpZDogJyArIG1zZy5pZCk7XG4gICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKHNlcnZlckRvYy5kb2N1bWVudCwgbXNnLmZpZWxkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IHJlbW92ZWQgZm9yIG5vbmV4aXN0aW5nIGlkOicgKyBtc2cuaWQpO1xuICAgICAgc2VydmVyRG9jLmRvY3VtZW50ID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCB7XG4gICAgICAgIG1zZzogJ3JlbW92ZWQnLFxuICAgICAgICBjb2xsZWN0aW9uOiBtc2cuY29sbGVjdGlvbixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfdXBkYXRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJvY2VzcyBcIm1ldGhvZCBkb25lXCIgbWVzc2FnZXMuXG5cbiAgICBtc2cubWV0aG9kcy5mb3JFYWNoKG1ldGhvZElkID0+IHtcbiAgICAgIGNvbnN0IGRvY3MgPSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXTtcbiAgICAgIGtleXMoZG9jcykuZm9yRWFjaChpZCA9PiB7XG4gICAgICAgIGNvbnN0IHdyaXR0ZW4gPSBkb2NzW2lkXTtcbiAgICAgICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKHdyaXR0ZW4uY29sbGVjdGlvbiwgd3JpdHRlbi5pZCk7XG4gICAgICAgIGlmICghIHNlcnZlckRvYykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTG9zdCBzZXJ2ZXJEb2MgZm9yICcgKyBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdEb2MgJyArXG4gICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHdyaXR0ZW4pICtcbiAgICAgICAgICAgICAgJyBub3Qgd3JpdHRlbiBieSAgbWV0aG9kICcgK1xuICAgICAgICAgICAgICBtZXRob2RJZFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF07XG4gICAgICAgIGlmIChpc0VtcHR5KHNlcnZlckRvYy53cml0dGVuQnlTdHVicykpIHtcbiAgICAgICAgICAvLyBBbGwgbWV0aG9kcyB3aG9zZSBzdHVicyB3cm90ZSB0aGlzIG1ldGhvZCBoYXZlIGNvbXBsZXRlZCEgV2UgY2FuXG4gICAgICAgICAgLy8gbm93IGNvcHkgdGhlIHNhdmVkIGRvY3VtZW50IHRvIHRoZSBkYXRhYmFzZSAocmV2ZXJ0aW5nIHRoZSBzdHViJ3NcbiAgICAgICAgICAvLyBjaGFuZ2UgaWYgdGhlIHNlcnZlciBkaWQgbm90IHdyaXRlIHRvIHRoaXMgb2JqZWN0LCBvciBhcHBseWluZyB0aGVcbiAgICAgICAgICAvLyBzZXJ2ZXIncyB3cml0ZXMgaWYgaXQgZGlkKS5cblxuICAgICAgICAgIC8vIFRoaXMgaXMgYSBmYWtlIGRkcCAncmVwbGFjZScgbWVzc2FnZS4gIEl0J3MganVzdCBmb3IgdGFsa2luZ1xuICAgICAgICAgIC8vIGJldHdlZW4gbGl2ZWRhdGEgY29ubmVjdGlvbnMgYW5kIG1pbmltb25nby4gIChXZSBoYXZlIHRvIHN0cmluZ2lmeVxuICAgICAgICAgIC8vIHRoZSBJRCBiZWNhdXNlIGl0J3Mgc3VwcG9zZWQgdG8gbG9vayBsaWtlIGEgd2lyZSBtZXNzYWdlLilcbiAgICAgICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIHdyaXR0ZW4uY29sbGVjdGlvbiwge1xuICAgICAgICAgICAgbXNnOiAncmVwbGFjZScsXG4gICAgICAgICAgICBpZDogTW9uZ29JRC5pZFN0cmluZ2lmeSh3cml0dGVuLmlkKSxcbiAgICAgICAgICAgIHJlcGxhY2U6IHNlcnZlckRvYy5kb2N1bWVudFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIENhbGwgYWxsIGZsdXNoIGNhbGxiYWNrcy5cblxuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5mb3JFYWNoKGMgPT4ge1xuICAgICAgICAgICAgYygpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gRGVsZXRlIHRoaXMgY29tcGxldGVkIHNlcnZlckRvY3VtZW50LiBEb24ndCBib3RoZXIgdG8gR0MgZW1wdHlcbiAgICAgICAgICAvLyBJZE1hcHMgaW5zaWRlIHNlbGYuX3NlcnZlckRvY3VtZW50cywgc2luY2UgdGhlcmUgcHJvYmFibHkgYXJlbid0XG4gICAgICAgICAgLy8gbWFueSBjb2xsZWN0aW9ucyBhbmQgdGhleSdsbCBiZSB3cml0dGVuIHJlcGVhdGVkbHkuXG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW3dyaXR0ZW4uY29sbGVjdGlvbl0ucmVtb3ZlKHdyaXR0ZW4uaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXTtcblxuICAgICAgLy8gV2Ugd2FudCB0byBjYWxsIHRoZSBkYXRhLXdyaXR0ZW4gY2FsbGJhY2ssIGJ1dCB3ZSBjYW4ndCBkbyBzbyB1bnRpbCBhbGxcbiAgICAgIC8vIGN1cnJlbnRseSBidWZmZXJlZCBtZXNzYWdlcyBhcmUgZmx1c2hlZC5cbiAgICAgIGNvbnN0IGNhbGxiYWNrSW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgIGlmICghIGNhbGxiYWNrSW52b2tlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNhbGxiYWNrIGludm9rZXIgZm9yIG1ldGhvZCAnICsgbWV0aG9kSWQpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoXG4gICAgICAgICguLi5hcmdzKSA9PiBjYWxsYmFja0ludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICBfcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJvY2VzcyBcInN1YiByZWFkeVwiIG1lc3NhZ2VzLiBcInN1YiByZWFkeVwiIG1lc3NhZ2VzIGRvbid0IHRha2UgZWZmZWN0XG4gICAgLy8gdW50aWwgYWxsIGN1cnJlbnQgc2VydmVyIGRvY3VtZW50cyBoYXZlIGJlZW4gZmx1c2hlZCB0byB0aGUgbG9jYWxcbiAgICAvLyBkYXRhYmFzZS4gV2UgY2FuIHVzZSBhIHdyaXRlIGZlbmNlIHRvIGltcGxlbWVudCB0aGlzLlxuXG4gICAgbXNnLnN1YnMuZm9yRWFjaChzdWJJZCA9PiB7XG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoKCkgPT4ge1xuICAgICAgICB2YXIgc3ViUmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tzdWJJZF07XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHVuc3Vic2NyaWJlP1xuICAgICAgICBpZiAoIXN1YlJlY29yZCkgcmV0dXJuO1xuICAgICAgICAvLyBEaWQgd2UgYWxyZWFkeSByZWNlaXZlIGEgcmVhZHkgbWVzc2FnZT8gKE9vcHMhKVxuICAgICAgICBpZiAoc3ViUmVjb3JkLnJlYWR5KSByZXR1cm47XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeSA9IHRydWU7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrICYmIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrKCk7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBFbnN1cmVzIHRoYXQgXCJmXCIgd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIGRvY3VtZW50cyBjdXJyZW50bHkgaW5cbiAgLy8gX3NlcnZlckRvY3VtZW50cyBoYXZlIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuIGYgd2lsbCBub3QgYmUgY2FsbGVkXG4gIC8vIGlmIHRoZSBjb25uZWN0aW9uIGlzIGxvc3QgYmVmb3JlIHRoZW4hXG4gIF9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoZikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcnVuRkFmdGVyVXBkYXRlcyA9ICgpID0+IHtcbiAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgfTtcbiAgICB2YXIgdW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPSAwO1xuICAgIHZhciBvblNlcnZlckRvY0ZsdXNoID0gKCkgPT4ge1xuICAgICAgLS11bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgIGlmICh1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9PT0gMCkge1xuICAgICAgICAvLyBUaGlzIHdhcyB0aGUgbGFzdCBkb2MgdG8gZmx1c2ghIEFycmFuZ2UgdG8gcnVuIGYgYWZ0ZXIgdGhlIHVwZGF0ZXNcbiAgICAgICAgLy8gaGF2ZSBiZWVuIGFwcGxpZWQuXG4gICAgICAgIHJ1bkZBZnRlclVwZGF0ZXMoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAga2V5cyhzZWxmLl9zZXJ2ZXJEb2N1bWVudHMpLmZvckVhY2goY29sbGVjdGlvbiA9PiB7XG4gICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uZm9yRWFjaChzZXJ2ZXJEb2MgPT4ge1xuICAgICAgICBjb25zdCB3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSA9XG4gICAgICAgICAga2V5cyhzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpLnNvbWUobWV0aG9kSWQgPT4ge1xuICAgICAgICAgICAgdmFyIGludm9rZXIgPSBzZWxmLl9tZXRob2RJbnZva2Vyc1ttZXRob2RJZF07XG4gICAgICAgICAgICByZXR1cm4gaW52b2tlciAmJiBpbnZva2VyLnNlbnRNZXNzYWdlO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSkge1xuICAgICAgICAgICsrdW5mbHVzaGVkU2VydmVyRG9jQ291bnQ7XG4gICAgICAgICAgc2VydmVyRG9jLmZsdXNoQ2FsbGJhY2tzLnB1c2gob25TZXJ2ZXJEb2NGbHVzaCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGlmICh1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9PT0gMCkge1xuICAgICAgLy8gVGhlcmUgYXJlbid0IGFueSBidWZmZXJlZCBkb2NzIC0tLSB3ZSBjYW4gY2FsbCBmIGFzIHNvb24gYXMgdGhlIGN1cnJlbnRcbiAgICAgIC8vIHJvdW5kIG9mIHVwZGF0ZXMgaXMgYXBwbGllZCFcbiAgICAgIHJ1bkZBZnRlclVwZGF0ZXMoKTtcbiAgICB9XG4gIH1cblxuICBfbGl2ZWRhdGFfbm9zdWIobXNnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRmlyc3QgcGFzcyBpdCB0aHJvdWdoIF9saXZlZGF0YV9kYXRhLCB3aGljaCBvbmx5IHVzZXMgaXQgdG8gaGVscCBnZXRcbiAgICAvLyB0b3dhcmRzIHF1aWVzY2VuY2UuXG4gICAgc2VsZi5fbGl2ZWRhdGFfZGF0YShtc2cpO1xuXG4gICAgLy8gRG8gdGhlIHJlc3Qgb2Ygb3VyIHByb2Nlc3NpbmcgaW1tZWRpYXRlbHksIHdpdGggbm9cbiAgICAvLyBidWZmZXJpbmctdW50aWwtcXVpZXNjZW5jZS5cblxuICAgIC8vIHdlIHdlcmVuJ3Qgc3ViYmVkIGFueXdheSwgb3Igd2UgaW5pdGlhdGVkIHRoZSB1bnN1Yi5cbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBtc2cuaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICB2YXIgZXJyb3JDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5lcnJvckNhbGxiYWNrO1xuICAgIHZhciBzdG9wQ2FsbGJhY2sgPSBzZWxmLl9zdWJzY3JpcHRpb25zW21zZy5pZF0uc3RvcENhbGxiYWNrO1xuXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLnJlbW92ZSgpO1xuXG4gICAgdmFyIG1ldGVvckVycm9yRnJvbU1zZyA9IG1zZ0FyZyA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBtc2dBcmcgJiZcbiAgICAgICAgbXNnQXJnLmVycm9yICYmXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmVycm9yLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5yZWFzb24sXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmRldGFpbHNcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBpZiAoZXJyb3JDYWxsYmFjayAmJiBtc2cuZXJyb3IpIHtcbiAgICAgIGVycm9yQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cblxuICAgIGlmIChzdG9wQ2FsbGJhY2spIHtcbiAgICAgIHN0b3BDYWxsYmFjayhtZXRlb3JFcnJvckZyb21Nc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgX2xpdmVkYXRhX3Jlc3VsdChtc2cpIHtcbiAgICAvLyBpZCwgcmVzdWx0IG9yIGVycm9yLiBlcnJvciBoYXMgZXJyb3IgKGNvZGUpLCByZWFzb24sIGRldGFpbHNcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIExldHMgbWFrZSBzdXJlIHRoZXJlIGFyZSBubyBidWZmZXJlZCB3cml0ZXMgYmVmb3JlIHJldHVybmluZyByZXN1bHQuXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9idWZmZXJlZFdyaXRlcykpIHtcbiAgICAgIHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICAvLyBmaW5kIHRoZSBvdXRzdGFuZGluZyByZXF1ZXN0XG4gICAgLy8gc2hvdWxkIGJlIE8oMSkgaW4gbmVhcmx5IGFsbCByZWFsaXN0aWMgdXNlIGNhc2VzXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBtZXRob2QgcmVzdWx0IGJ1dCBubyBtZXRob2RzIG91dHN0YW5kaW5nJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBjdXJyZW50TWV0aG9kQmxvY2sgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzO1xuICAgIHZhciBtO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY3VycmVudE1ldGhvZEJsb2NrLmxlbmd0aDsgaSsrKSB7XG4gICAgICBtID0gY3VycmVudE1ldGhvZEJsb2NrW2ldO1xuICAgICAgaWYgKG0ubWV0aG9kSWQgPT09IG1zZy5pZCkgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKCFtKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiQ2FuJ3QgbWF0Y2ggbWV0aG9kIHJlc3BvbnNlIHRvIG9yaWdpbmFsIG1ldGhvZCBjYWxsXCIsIG1zZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGZyb20gY3VycmVudCBtZXRob2QgYmxvY2suIFRoaXMgbWF5IGxlYXZlIHRoZSBibG9jayBlbXB0eSwgYnV0IHdlXG4gICAgLy8gZG9uJ3QgbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayB1bnRpbCB0aGUgY2FsbGJhY2sgaGFzIGJlZW4gZGVsaXZlcmVkLCBpblxuICAgIC8vIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkLlxuICAgIGN1cnJlbnRNZXRob2RCbG9jay5zcGxpY2UoaSwgMSk7XG5cbiAgICBpZiAoaGFzT3duLmNhbGwobXNnLCAnZXJyb3InKSkge1xuICAgICAgbS5yZWNlaXZlUmVzdWx0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKG1zZy5lcnJvci5lcnJvciwgbXNnLmVycm9yLnJlYXNvbiwgbXNnLmVycm9yLmRldGFpbHMpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBtc2cucmVzdWx0IG1heSBiZSB1bmRlZmluZWQgaWYgdGhlIG1ldGhvZCBkaWRuJ3QgcmV0dXJuIGFcbiAgICAgIC8vIHZhbHVlXG4gICAgICBtLnJlY2VpdmVSZXN1bHQodW5kZWZpbmVkLCBtc2cucmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICAvLyBDYWxsZWQgYnkgTWV0aG9kSW52b2tlciBhZnRlciBhIG1ldGhvZCdzIGNhbGxiYWNrIGlzIGludm9rZWQuICBJZiB0aGlzIHdhc1xuICAvLyB0aGUgbGFzdCBvdXRzdGFuZGluZyBtZXRob2QgaW4gdGhlIGN1cnJlbnQgYmxvY2ssIHJ1bnMgdGhlIG5leHQgYmxvY2suIElmXG4gIC8vIHRoZXJlIGFyZSBubyBtb3JlIG1ldGhvZHMsIGNvbnNpZGVyIGFjY2VwdGluZyBhIGhvdCBjb2RlIHB1c2guXG4gIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkpIHJldHVybjtcblxuICAgIC8vIE5vIG1ldGhvZHMgYXJlIG91dHN0YW5kaW5nLiBUaGlzIHNob3VsZCBtZWFuIHRoYXQgdGhlIGZpcnN0IGJsb2NrIG9mXG4gICAgLy8gbWV0aG9kcyBpcyBlbXB0eS4gKE9yIGl0IG1pZ2h0IG5vdCBleGlzdCwgaWYgdGhpcyB3YXMgYSBtZXRob2QgdGhhdFxuICAgIC8vIGhhbGYtZmluaXNoZWQgYmVmb3JlIGRpc2Nvbm5lY3QvcmVjb25uZWN0LilcbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgdmFyIGZpcnN0QmxvY2sgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgICAgaWYgKCEgaXNFbXB0eShmaXJzdEJsb2NrLm1ldGhvZHMpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ05vIG1ldGhvZHMgb3V0c3RhbmRpbmcgYnV0IG5vbmVtcHR5IGJsb2NrOiAnICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGZpcnN0QmxvY2spXG4gICAgICAgICk7XG5cbiAgICAgIC8vIFNlbmQgdGhlIG91dHN0YW5kaW5nIG1ldGhvZHMgbm93IGluIHRoZSBmaXJzdCBibG9jay5cbiAgICAgIGlmICghIGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKVxuICAgICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgfVxuXG4gICAgLy8gTWF5YmUgYWNjZXB0IGEgaG90IGNvZGUgcHVzaC5cbiAgICBzZWxmLl9tYXliZU1pZ3JhdGUoKTtcbiAgfVxuXG4gIC8vIFNlbmRzIG1lc3NhZ2VzIGZvciBhbGwgdGhlIG1ldGhvZHMgaW4gdGhlIGZpcnN0IGJsb2NrIGluXG4gIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5cbiAgX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKG0gPT4ge1xuICAgICAgbS5zZW5kTWVzc2FnZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgX2xpdmVkYXRhX2Vycm9yKG1zZykge1xuICAgIE1ldGVvci5fZGVidWcoJ1JlY2VpdmVkIGVycm9yIGZyb20gc2VydmVyOiAnLCBtc2cucmVhc29uKTtcbiAgICBpZiAobXNnLm9mZmVuZGluZ01lc3NhZ2UpIE1ldGVvci5fZGVidWcoJ0ZvcjogJywgbXNnLm9mZmVuZGluZ01lc3NhZ2UpO1xuICB9XG5cbiAgX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIHNlbGYub25SZWNvbm5lY3QgJiYgc2VsZi5vblJlY29ubmVjdCgpO1xuICAgIEREUC5fcmVjb25uZWN0SG9vay5lYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgIGNhbGxiYWNrKHNlbGYpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICBpZiAoaXNFbXB0eShvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHJldHVybjtcblxuICAgIC8vIFdlIGhhdmUgYXQgbGVhc3Qgb25lIGJsb2NrIHdvcnRoIG9mIG9sZCBvdXRzdGFuZGluZyBtZXRob2RzIHRvIHRyeVxuICAgIC8vIGFnYWluLiBGaXJzdDogZGlkIG9uUmVjb25uZWN0IGFjdHVhbGx5IHNlbmQgYW55dGhpbmc/IElmIG5vdCwgd2UganVzdFxuICAgIC8vIHJlc3RvcmUgYWxsIG91dHN0YW5kaW5nIG1ldGhvZHMgYW5kIHJ1biB0aGUgZmlyc3QgYmxvY2suXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzO1xuICAgICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9LLCB0aGVyZSBhcmUgYmxvY2tzIG9uIGJvdGggc2lkZXMuIFNwZWNpYWwgY2FzZTogbWVyZ2UgdGhlIGxhc3QgYmxvY2sgb2ZcbiAgICAvLyB0aGUgcmVjb25uZWN0IG1ldGhvZHMgd2l0aCB0aGUgZmlyc3QgYmxvY2sgb2YgdGhlIG9yaWdpbmFsIG1ldGhvZHMsIGlmXG4gICAgLy8gbmVpdGhlciBvZiB0aGVtIGFyZSBcIndhaXRcIiBibG9ja3MuXG4gICAgaWYgKCEgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcykud2FpdCAmJlxuICAgICAgICAhIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLndhaXQpIHtcbiAgICAgIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMuZm9yRWFjaChtID0+IHtcbiAgICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG0pO1xuXG4gICAgICAgIC8vIElmIHRoaXMgXCJsYXN0IGJsb2NrXCIgaXMgYWxzbyB0aGUgZmlyc3QgYmxvY2ssIHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE5vdyBhZGQgdGhlIHJlc3Qgb2YgdGhlIG9yaWdpbmFsIGJsb2NrcyBvbi5cbiAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5mb3JFYWNoKGJsb2NrID0+IHtcbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goYmxvY2spO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gV2UgY2FuIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2ggaWYgdGhlcmUgYXJlIG5vIG1ldGhvZHMgaW4gZmxpZ2h0LlxuICBfcmVhZHlUb01pZ3JhdGUoKSB7XG4gICAgcmV0dXJuIGlzRW1wdHkodGhpcy5fbWV0aG9kSW52b2tlcnMpO1xuICB9XG5cbiAgLy8gSWYgd2Ugd2VyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgc2VlIGlmIGl0J3Mgbm93IHBvc3NpYmxlIHRvIGNvbnRpbnVlLlxuICAvLyBDYWxsIHdoZW5ldmVyIHRoZSBzZXQgb2Ygb3V0c3RhbmRpbmcvYmxvY2tlZCBtZXRob2RzIHNocmlua3MuXG4gIF9tYXliZU1pZ3JhdGUoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9yZXRyeU1pZ3JhdGUgJiYgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgc2VsZi5fcmV0cnlNaWdyYXRlKCk7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVzc2FnZShyYXdfbXNnKSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnRXhjZXB0aW9uIHdoaWxlIHBhcnNpbmcgRERQJywgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIHNlcnZlciBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAodGhpcy5faGVhcnRiZWF0KSB7XG4gICAgICB0aGlzLl9oZWFydGJlYXQubWVzc2FnZVJlY2VpdmVkKCk7XG4gICAgfVxuXG4gICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDAuNi42LiBpZ25vcmUgdGhlIG9sZCB3ZWxjb21lIG1lc3NhZ2UgZm9yIGJhY2tcbiAgICAgIC8vIGNvbXBhdC4gIFJlbW92ZSB0aGlzICdpZicgb25jZSB0aGUgc2VydmVyIHN0b3BzIHNlbmRpbmcgd2VsY29tZVxuICAgICAgLy8gbWVzc2FnZXMgKHN0cmVhbV9zZXJ2ZXIuanMpLlxuICAgICAgaWYgKCEobXNnICYmIG1zZy5zZXJ2ZXJfaWQpKVxuICAgICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIGludmFsaWQgbGl2ZWRhdGEgbWVzc2FnZScsIG1zZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0ZWQnKSB7XG4gICAgICB0aGlzLl92ZXJzaW9uID0gdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb247XG4gICAgICB0aGlzLl9saXZlZGF0YV9jb25uZWN0ZWQobXNnKTtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkNvbm5lY3RlZCgpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2ZhaWxlZCcpIHtcbiAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucy5pbmRleE9mKG1zZy52ZXJzaW9uKSA+PSAwKSB7XG4gICAgICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgICAgIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoeyBfZm9yY2U6IHRydWUgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZGVzY3JpcHRpb24gPVxuICAgICAgICAgICdERFAgdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlsZWQ7IHNlcnZlciByZXF1ZXN0ZWQgdmVyc2lvbiAnICtcbiAgICAgICAgICBtc2cudmVyc2lvbjtcbiAgICAgICAgdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlLCBfZXJyb3I6IGRlc2NyaXB0aW9uIH0pO1xuICAgICAgICB0aGlzLm9wdGlvbnMub25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdwaW5nJyAmJiB0aGlzLm9wdGlvbnMucmVzcG9uZFRvUGluZ3MpIHtcbiAgICAgIHRoaXMuX3NlbmQoeyBtc2c6ICdwb25nJywgaWQ6IG1zZy5pZCB9KTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gbm9vcCwgYXMgd2UgYXNzdW1lIGV2ZXJ5dGhpbmcncyBhIHBvbmdcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgWydhZGRlZCcsICdjaGFuZ2VkJywgJ3JlbW92ZWQnLCAncmVhZHknLCAndXBkYXRlZCddLmluY2x1ZGVzKG1zZy5tc2cpXG4gICAgKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9kYXRhKG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnbm9zdWInKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9ub3N1Yihtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3Jlc3VsdCcpIHtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX3Jlc3VsdChtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2Vycm9yJykge1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfZXJyb3IobXNnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIG1lc3NhZ2UgdHlwZScsIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgb25SZXNldCgpIHtcbiAgICAvLyBTZW5kIGEgY29ubmVjdCBtZXNzYWdlIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHN0cmVhbS5cbiAgICAvLyBOT1RFOiByZXNldCBpcyBjYWxsZWQgZXZlbiBvbiB0aGUgZmlyc3QgY29ubmVjdGlvbiwgc28gdGhpcyBpc1xuICAgIC8vIHRoZSBvbmx5IHBsYWNlIHdlIHNlbmQgdGhpcyBtZXNzYWdlLlxuICAgIHZhciBtc2cgPSB7IG1zZzogJ2Nvbm5lY3QnIH07XG4gICAgaWYgKHRoaXMuX2xhc3RTZXNzaW9uSWQpIG1zZy5zZXNzaW9uID0gdGhpcy5fbGFzdFNlc3Npb25JZDtcbiAgICBtc2cudmVyc2lvbiA9IHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uIHx8IHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zWzBdO1xuICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgbXNnLnN1cHBvcnQgPSB0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucztcbiAgICB0aGlzLl9zZW5kKG1zZyk7XG5cbiAgICAvLyBNYXJrIG5vbi1yZXRyeSBjYWxscyBhcyBmYWlsZWQuIFRoaXMgaGFzIHRvIGJlIGRvbmUgZWFybHkgYXMgZ2V0dGluZyB0aGVzZSBtZXRob2RzIG91dCBvZiB0aGVcbiAgICAvLyBjdXJyZW50IGJsb2NrIGlzIHByZXR0eSBpbXBvcnRhbnQgdG8gbWFraW5nIHN1cmUgdGhhdCBxdWllc2NlbmNlIGlzIHByb3Blcmx5IGNhbGN1bGF0ZWQsIGFzXG4gICAgLy8gd2VsbCBhcyBwb3NzaWJseSBtb3Zpbmcgb24gdG8gYW5vdGhlciB1c2VmdWwgYmxvY2suXG5cbiAgICAvLyBPbmx5IGJvdGhlciB0ZXN0aW5nIGlmIHRoZXJlIGlzIGFuIG91dHN0YW5kaW5nTWV0aG9kQmxvY2sgKHRoZXJlIG1pZ2h0IG5vdCBiZSwgZXNwZWNpYWxseSBpZlxuICAgIC8vIHdlIGFyZSBjb25uZWN0aW5nIGZvciB0aGUgZmlyc3QgdGltZS5cbiAgICBpZiAodGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID4gMCkge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gb3V0c3RhbmRpbmcgbWV0aG9kIGJsb2NrLCB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIGZpcnN0IG9uZSBhcyB0aGF0IGlzIHRoZVxuICAgICAgLy8gb25lIHRoYXQgY291bGQgaGF2ZSBhbHJlYWR5IHNlbnQgbWVzc2FnZXMgd2l0aCBubyByZXNwb25zZSwgdGhhdCBhcmUgbm90IGFsbG93ZWQgdG8gcmV0cnkuXG4gICAgICBjb25zdCBjdXJyZW50TWV0aG9kQmxvY2sgPSB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzO1xuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcyA9IGN1cnJlbnRNZXRob2RCbG9jay5maWx0ZXIoXG4gICAgICAgIG1ldGhvZEludm9rZXIgPT4ge1xuICAgICAgICAgIC8vIE1ldGhvZHMgd2l0aCAnbm9SZXRyeScgb3B0aW9uIHNldCBhcmUgbm90IGFsbG93ZWQgdG8gcmUtc2VuZCBhZnRlclxuICAgICAgICAgIC8vIHJlY292ZXJpbmcgZHJvcHBlZCBjb25uZWN0aW9uLlxuICAgICAgICAgIGlmIChtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSkge1xuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIG1ldGhvZCBpcyB0b2xkIHRoYXQgaXQgZmFpbGVkLlxuICAgICAgICAgICAgbWV0aG9kSW52b2tlci5yZWNlaXZlUmVzdWx0KFxuICAgICAgICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICAgICdpbnZvY2F0aW9uLWZhaWxlZCcsXG4gICAgICAgICAgICAgICAgJ01ldGhvZCBpbnZvY2F0aW9uIG1pZ2h0IGhhdmUgZmFpbGVkIGR1ZSB0byBkcm9wcGVkIGNvbm5lY3Rpb24uICcgK1xuICAgICAgICAgICAgICAgICAgJ0ZhaWxpbmcgYmVjYXVzZSBgbm9SZXRyeWAgb3B0aW9uIHdhcyBwYXNzZWQgdG8gTWV0ZW9yLmFwcGx5LidcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPbmx5IGtlZXAgYSBtZXRob2QgaWYgaXQgd2Fzbid0IHNlbnQgb3IgaXQncyBhbGxvd2VkIHRvIHJldHJ5LlxuICAgICAgICAgIC8vIFRoaXMgbWF5IGxlYXZlIHRoZSBibG9jayBlbXB0eSwgYnV0IHdlIGRvbid0IG1vdmUgb24gdG8gdGhlIG5leHRcbiAgICAgICAgICAvLyBibG9jayB1bnRpbCB0aGUgY2FsbGJhY2sgaGFzIGJlZW4gZGVsaXZlcmVkLCBpbiBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZC5cbiAgICAgICAgICByZXR1cm4gIShtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gTm93LCB0byBtaW5pbWl6ZSBzZXR1cCBsYXRlbmN5LCBnbyBhaGVhZCBhbmQgYmxhc3Qgb3V0IGFsbCBvZlxuICAgIC8vIG91ciBwZW5kaW5nIG1ldGhvZHMgYW5kcyBzdWJzY3JpcHRpb25zIGJlZm9yZSB3ZSd2ZSBldmVuIHRha2VuXG4gICAgLy8gdGhlIG5lY2Vzc2FyeSBSVFQgdG8ga25vdyBpZiB3ZSBzdWNjZXNzZnVsbHkgcmVjb25uZWN0ZWQuICgxKVxuICAgIC8vIFRoZXkncmUgc3VwcG9zZWQgdG8gYmUgaWRlbXBvdGVudCwgYW5kIHdoZXJlIHRoZXkgYXJlIG5vdCxcbiAgICAvLyB0aGV5IGNhbiBibG9jayByZXRyeSBpbiBhcHBseTsgKDIpIGV2ZW4gaWYgd2UgZGlkIHJlY29ubmVjdCxcbiAgICAvLyB3ZSdyZSBub3Qgc3VyZSB3aGF0IG1lc3NhZ2VzIG1pZ2h0IGhhdmUgZ290dGVuIGxvc3RcbiAgICAvLyAoaW4gZWl0aGVyIGRpcmVjdGlvbikgc2luY2Ugd2Ugd2VyZSBkaXNjb25uZWN0ZWQgKFRDUCBiZWluZ1xuICAgIC8vIHNsb3BweSBhYm91dCB0aGF0LilcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IGJsb2NrIG9mIG1ldGhvZHMgYWxsIGdvdCB0aGVpciByZXN1bHRzIChidXQgZGlkbid0IGFsbCBnZXRcbiAgICAvLyB0aGVpciBkYXRhIHZpc2libGUpLCBkaXNjYXJkIHRoZSBlbXB0eSBibG9jayBub3cuXG4gICAgaWYgKFxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID4gMCAmJlxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5sZW5ndGggPT09IDBcbiAgICApIHtcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgLy8gTWFyayBhbGwgbWVzc2FnZXMgYXMgdW5zZW50LCB0aGV5IGhhdmUgbm90IHlldCBiZWVuIHNlbnQgb24gdGhpc1xuICAgIC8vIGNvbm5lY3Rpb24uXG4gICAga2V5cyh0aGlzLl9tZXRob2RJbnZva2VycykuZm9yRWFjaChpZCA9PiB7XG4gICAgICB0aGlzLl9tZXRob2RJbnZva2Vyc1tpZF0uc2VudE1lc3NhZ2UgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8vIElmIGFuIGBvblJlY29ubmVjdGAgaGFuZGxlciBpcyBzZXQsIGNhbGwgaXQgZmlyc3QuIEdvIHRocm91Z2hcbiAgICAvLyBzb21lIGhvb3BzIHRvIGVuc3VyZSB0aGF0IG1ldGhvZHMgdGhhdCBhcmUgY2FsbGVkIGZyb20gd2l0aGluXG4gICAgLy8gYG9uUmVjb25uZWN0YCBnZXQgZXhlY3V0ZWQgX2JlZm9yZV8gb25lcyB0aGF0IHdlcmUgb3JpZ2luYWxseVxuICAgIC8vIG91dHN0YW5kaW5nIChzaW5jZSBgb25SZWNvbm5lY3RgIGlzIHVzZWQgdG8gcmUtZXN0YWJsaXNoIGF1dGhcbiAgICAvLyBjZXJ0aWZpY2F0ZXMpXG4gICAgdGhpcy5fY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCk7XG5cbiAgICAvLyBhZGQgbmV3IHN1YnNjcmlwdGlvbnMgYXQgdGhlIGVuZC4gdGhpcyB3YXkgdGhleSB0YWtlIGVmZmVjdCBhZnRlclxuICAgIC8vIHRoZSBoYW5kbGVycyBhbmQgd2UgZG9uJ3Qgc2VlIGZsaWNrZXIuXG4gICAga2V5cyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgIGNvbnN0IHN1YiA9IHRoaXMuX3N1YnNjcmlwdGlvbnNbaWRdO1xuICAgICAgdGhpcy5fc2VuZCh7XG4gICAgICAgIG1zZzogJ3N1YicsXG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogc3ViLm5hbWUsXG4gICAgICAgIHBhcmFtczogc3ViLnBhcmFtc1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEREUENvbW1vbiB9IGZyb20gJ21ldGVvci9kZHAtY29tbW9uJztcbmltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsga2V5cyB9IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5pbXBvcnQgeyBDb25uZWN0aW9uIH0gZnJvbSAnLi9saXZlZGF0YV9jb25uZWN0aW9uLmpzJztcblxuLy8gVGhpcyBhcnJheSBhbGxvd3MgdGhlIGBfYWxsU3Vic2NyaXB0aW9uc1JlYWR5YCBtZXRob2QgYmVsb3csIHdoaWNoXG4vLyBpcyB1c2VkIGJ5IHRoZSBgc3BpZGVyYWJsZWAgcGFja2FnZSwgdG8ga2VlcCB0cmFjayBvZiB3aGV0aGVyIGFsbFxuLy8gZGF0YSBpcyByZWFkeS5cbmNvbnN0IGFsbENvbm5lY3Rpb25zID0gW107XG5cbi8qKlxuICogQG5hbWVzcGFjZSBERFBcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgRERQLXJlbGF0ZWQgbWV0aG9kcy9jbGFzc2VzLlxuICovXG5leHBvcnQgY29uc3QgRERQID0ge307XG5cbi8vIFRoaXMgaXMgcHJpdmF0ZSBidXQgaXQncyB1c2VkIGluIGEgZmV3IHBsYWNlcy4gYWNjb3VudHMtYmFzZSB1c2VzXG4vLyBpdCB0byBnZXQgdGhlIGN1cnJlbnQgdXNlci4gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIGZyaWVuZHMgY2xlYXJcbi8vIGl0LiBXZSBjYW4gcHJvYmFibHkgZmluZCBhIGJldHRlciB3YXkgdG8gZmFjdG9yIHRoaXMuXG5ERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5ERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcblxuLy8gWFhYOiBLZWVwIEREUC5fQ3VycmVudEludm9jYXRpb24gZm9yIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuRERQLl9DdXJyZW50SW52b2NhdGlvbiA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb247XG5cbi8vIFRoaXMgaXMgcGFzc2VkIGludG8gYSB3ZWlyZCBgbWFrZUVycm9yVHlwZWAgZnVuY3Rpb24gdGhhdCBleHBlY3RzIGl0cyB0aGluZ1xuLy8gdG8gYmUgYSBjb25zdHJ1Y3RvclxuZnVuY3Rpb24gY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5ERFAuQ29ubmVjdGlvbkVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuQ29ubmVjdGlvbkVycm9yJyxcbiAgY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3Jcbik7XG5cbkREUC5Gb3JjZWRSZWNvbm5lY3RFcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKFxuICAnRERQLkZvcmNlZFJlY29ubmVjdEVycm9yJyxcbiAgKCkgPT4ge31cbik7XG5cbi8vIFJldHVybnMgdGhlIG5hbWVkIHNlcXVlbmNlIG9mIHBzZXVkby1yYW5kb20gdmFsdWVzLlxuLy8gVGhlIHNjb3BlIHdpbGwgYmUgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKSwgc28gdGhlIHN0cmVhbSB3aWxsIHByb2R1Y2Vcbi8vIGNvbnNpc3RlbnQgdmFsdWVzIGZvciBtZXRob2QgY2FsbHMgb24gdGhlIGNsaWVudCBhbmQgc2VydmVyLlxuRERQLnJhbmRvbVN0cmVhbSA9IG5hbWUgPT4ge1xuICB2YXIgc2NvcGUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICByZXR1cm4gRERQQ29tbW9uLlJhbmRvbVN0cmVhbS5nZXQoc2NvcGUsIG5hbWUpO1xufTtcblxuLy8gQHBhcmFtIHVybCB7U3RyaW5nfSBVUkwgdG8gTWV0ZW9yIGFwcCxcbi8vICAgICBlLmcuOlxuLy8gICAgIFwic3ViZG9tYWluLm1ldGVvci5jb21cIixcbi8vICAgICBcImh0dHA6Ly9zdWJkb21haW4ubWV0ZW9yLmNvbVwiLFxuLy8gICAgIFwiL1wiLFxuLy8gICAgIFwiZGRwK3NvY2tqczovL2RkcC0tKioqKi1mb28ubWV0ZW9yLmNvbS9zb2NranNcIlxuXG4vKipcbiAqIEBzdW1tYXJ5IENvbm5lY3QgdG8gdGhlIHNlcnZlciBvZiBhIGRpZmZlcmVudCBNZXRlb3IgYXBwbGljYXRpb24gdG8gc3Vic2NyaWJlIHRvIGl0cyBkb2N1bWVudCBzZXRzIGFuZCBpbnZva2UgaXRzIHJlbW90ZSBtZXRob2RzLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgb2YgYW5vdGhlciBNZXRlb3IgYXBwbGljYXRpb24uXG4gKi9cbkREUC5jb25uZWN0ID0gKHVybCwgb3B0aW9ucykgPT4ge1xuICB2YXIgcmV0ID0gbmV3IENvbm5lY3Rpb24odXJsLCBvcHRpb25zKTtcbiAgYWxsQ29ubmVjdGlvbnMucHVzaChyZXQpOyAvLyBoYWNrLiBzZWUgYmVsb3cuXG4gIHJldHVybiByZXQ7XG59O1xuXG5ERFAuX3JlY29ubmVjdEhvb2sgPSBuZXcgSG9vayh7IGJpbmRFbnZpcm9ubWVudDogZmFsc2UgfSk7XG5cbi8qKlxuICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBjYWxsIGFzIHRoZSBmaXJzdCBzdGVwIG9mXG4gKiByZWNvbm5lY3RpbmcuIFRoaXMgZnVuY3Rpb24gY2FuIGNhbGwgbWV0aG9kcyB3aGljaCB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZVxuICogYW55IG90aGVyIG91dHN0YW5kaW5nIG1ldGhvZHMuIEZvciBleGFtcGxlLCB0aGlzIGNhbiBiZSB1c2VkIHRvIHJlLWVzdGFibGlzaFxuICogdGhlIGFwcHJvcHJpYXRlIGF1dGhlbnRpY2F0aW9uIGNvbnRleHQgb24gdGhlIGNvbm5lY3Rpb24uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGFcbiAqIHNpbmdsZSBhcmd1bWVudCwgdGhlIFtjb25uZWN0aW9uIG9iamVjdF0oI2RkcF9jb25uZWN0KSB0aGF0IGlzIHJlY29ubmVjdGluZy5cbiAqL1xuRERQLm9uUmVjb25uZWN0ID0gY2FsbGJhY2sgPT4ge1xuICByZXR1cm4gRERQLl9yZWNvbm5lY3RIb29rLnJlZ2lzdGVyKGNhbGxiYWNrKTtcbn07XG5cbi8vIEhhY2sgZm9yIGBzcGlkZXJhYmxlYCBwYWNrYWdlOiBhIHdheSB0byBzZWUgaWYgdGhlIHBhZ2UgaXMgZG9uZVxuLy8gbG9hZGluZyBhbGwgdGhlIGRhdGEgaXQgbmVlZHMuXG4vL1xuRERQLl9hbGxTdWJzY3JpcHRpb25zUmVhZHkgPSAoKSA9PiB7XG4gIHJldHVybiBhbGxDb25uZWN0aW9ucy5ldmVyeShjb25uID0+IHtcbiAgICByZXR1cm4ga2V5cyhjb25uLl9zdWJzY3JpcHRpb25zKS5ldmVyeShpZCA9PiB7XG4gICAgICByZXR1cm4gY29ubi5fc3Vic2NyaXB0aW9uc1tpZF0ucmVhZHk7XG4gICAgfSk7XG4gIH0pO1xufTtcbiJdfQ==
