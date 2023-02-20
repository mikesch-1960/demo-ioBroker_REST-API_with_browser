class C_RestApi {
  // ----- values needed for connecting the REST-API
    // the complete head of the URL to connect to the REST_API (e.g.: http://iobroker:8093/)
  #baseURL          = null;
    // an unique id for every connection to the REST-API; Default is random string.
  #sessionId        = "";
    // required information to connect to the REST_API
  #authorization    = {user:"", password:""};

  // ----- values needed for the long polling service
    // milliseconds that a polling connection waits
  #pollPeriod       = 60000;
    // true for the first poll, where the long poll interval must be send to REST-API
  #firstPoll        = true;
    // true while long polling is active
  #isPolling        = false;
    // while polling, this stores the defined subscriptions
  #subscriptions    = {};
    // object, that can abort a fetch operation
  #abortCtrl        = null;
    // delay for retrying to reactivate polling, after an error occurred
  #retryPollDelay   = 5000;

  // ----- callbacks
    // parameter: true/false; returns: void
  onPollstateChange = null; // called, if polling status changed
    // parameter: the error object; returns: void
  onError           = null; // called, if an error occurred while polling
    // parameter: none; returns: void or milliseconds to wait for the next polling
  onEmptyPoll       = null; // called, if no messages were received within the polling interval
    // parameter: JSON object; returns: void
  onPollMsg         = null; // called, if a message from a subscribed datapoint is received


  constructor(baseURL, sessionId, user, password, pollPeriod, retryPollDelay) {
    this.#baseURL         = baseURL + (baseURL[baseURL.length - 1] !== '/' ? "/" : "") + "v1/";
    this.#sessionId       = sessionId || Date.now() + '_' + Math.round(Math.random() * 10000);
    this.#authorization   = {user: user || "", password: password || ""};
    this.#pollPeriod      = pollPeriod || 30000;
    this.#retryPollDelay  = retryPollDelay || 5000;

    this.#firstPoll       = true;
    this.#isPolling       = false;
    this.#subscriptions   = {};
    this.#abortCtrl       = null;
  }   // constructor()

  startPolling() {
    console.info("REST-API: start polling...");

    if (!this.#abortCtrl || this.#abortCtrl.signal.aborted) {
      // This is the only way to reset the AbortController
      this.#abortCtrl = new AbortController();
    }
    this.#firstPoll   = true;
    this.#lngPoll();
  }

  stopPolling() {
    console.info("REST-API: stopp polling...");
    // this.#subscriptions stay defined for resubscribe them when restart the polling
    this.#abortCtrl.abort();
  }

  /*
    Subscribe a single datapoint. Changes made to the datapoint trigger the event onPollMsg.
    The idObject can be an object that contains additional data for the correspondending
    datapoint. This object is added to the payload object of the onPollMsg event with the
    key 'idData'.
  */
  subscribeState(id, idObject) {
    console.info(`REST-API: subscribe state to ${id}`);

    if (this.#subscriptions[id]) {
      console.warn(`REST-API: subscribe state id '${id}' allready subscribed!`);
    }

    // 'state' is the part of the URL for the REST-API adapter, to subscribe to a single datapoint
    this.#subscribe(id, idObject, "state");
  }   // subscribeState()

  /*
    Subscribe a pattern for datapoint. Changes made to any of the datapoints trigger the
    event onPollMsg.
    The idObject can be an object that contains additional data for the correspondending
    datapoint. This object is added to the payload object of the onPollMsg event with the
    key 'idData'.
  */
  subscribePattern(id, xObject) {
    console.info(`REST-API: subscribe pattern to ${id}`);

    if (this.#subscriptions[id]) {
      console.warn(`REST-API: subscribe pattern id '${id}' allready subscribed!`);
    }

    // 'states' is the part of the URL for the REST-API adapter, to subscribe to multiple datapoints
    this.#subscribe(id, xObject, "states");
  }   // subscribePattern()

  //### This method does not work. I cant figure out how to call this command on the REST-API adapter
  unsubscribeAll() {
    console.info("REST-API: unsubscribe all");

    for (const [id, value] of Object.entries(this.#subscriptions)) {
      // console.debug(`unsubscribe ${id}: ${value.idtype}, ${value.iddata}`);

      // for shelly datapoints the # must be masked
      const xid = value?.idtype==="states" ? id : id.replaceAll('#', '%23');

      fetch(`${this.#baseURL}${value.idtype}/${xid}/unsubscribe?sid=${this.#sessionId}&method=polling`,
        { method: 'POST', headers: this.#getHeaders() }
      )
      .then(response => response.text())
      .then(data =>
        console.info(`unsubscribed ${value.idtype} '${id}'; data=${data}`)
      )
      .catch(error => console.error(`REST-API: Cannot unsubscribe ${value.idtype} '${id}': ${error}`));
    }   // for (...
  }   // unsubscribeAll()

  setState(id, value) {
    return  fetch(`${this.#baseURL}command/setState?id=${id.replaceAll('#', '%23')}&state=${value}`,
        { headers: this.#getHeaders() }
      )
      .then(response => response.json())
  }

  toggleState(id) {
    return  fetch(`${this.#baseURL}state/${id.replaceAll('#', '%23')}/toggle`,
        { headers: this.#getHeaders() }
      )
      .then(response => response.json())
  }

  getState(id) {
    return  fetch(`${this.#baseURL}state/${id.replaceAll('#', '%23')}`,
        { headers: this.#getHeaders() }
      )
      .then(response => response.json())
  }

  getObject(id) {
    return fetch(`${this.#baseURL}object/${id.replaceAll('#', '%23')}`,
        { headers: this.#getHeaders() }
      )
      .then(response => response.json())
  }

  getBaseUrl() {
    return this.baseURL;
  }

  getSessionId() {
    return this.#sessionId;
  }

  getPollPeriod() {
    return this.#pollPeriod;
  }

  getAborted() {
    return this.#abortCtrl && this.#abortCtrl.signal.aborted;
  }

  isPolling() {
    return this.#isPolling;
  }

  getSubscriptionData(id) {
    return this.#subscriptions && this.#subscriptions[id] && this.#subscriptions[id].isdata;
  }

  // ------------  private methods --------------------------------

  #subscribe(id, idObject, kind) {
    // console.debug(`REST-API: subscribe ${kind} to ${id}`)

    if (!this.#subscriptions[id]) {
      idObject = idObject || {};
      this.#subscriptions[id] = {idtype: kind, iddata: idObject};
    }

    if (this.#isPolling) {
      const xid = kind==="states" ? id : id.replaceAll('#', '%23');  //### to a function; for shelly datapoints the # must be masked
      fetch(`${this.#baseURL}${kind}/${xid}/subscribe?sid=${this.#sessionId}&method=polling`,
        { signal: this.#abortCtrl.signal, headers: this.#getHeaders() }
      )
      .then(response => response.json())
      .then(data =>
        {
          const msgObj = {id: id, state: data, iddata: this.#subscriptions[id].iddata};
          this.onPollMsg && this.onPollMsg(msgObj);
        }
      )
      .catch(error => console.error(`REST-API: Cannot subscribe ${kind}: ${error}`));
    }   // if(isPolling)...
  }   //#subscribe()

  #resubscribeAll() {
    console.info("REST-API: resubscribe all");

    for (const [id, value] of Object.entries(this.#subscriptions)) {
      this.#subscribe(id, value.iddata, value.idtype);
    }
  }   // #resubscribeAll()

  #setPollstate(state) {
    if (this.#isPolling !== state) {
      this.#isPolling = state;
      this.onPollstateChange && this.onPollstateChange(state);
    }
  }   // #setPollstate()

  #getHeaders(jsonType=false) {
    if (this.#authorization.user) {
      const headers = {
        Authorization: 'Basic ' + btoa(this.#authorization.user + ':' + this.#authorization.password)
      };

      if (jsonType) {
        headers['Content-Type'] = 'application/json';
      }
      return headers;
    } else
    if (jsonType) {
      return {'Content-Type': 'application/json'};
    } else {
      return undefined;
    }
  }   // #getHeaders()

  #lngPoll() {
    if (this.#abortCtrl && this.#abortCtrl.signal.aborted)
      return false;

    fetch(`${this.#baseURL}polling?sid=${this.#sessionId}${this.#firstPoll ? '&connect&timeout='+this.#pollPeriod : ''}`,
      { signal: this.#abortCtrl.signal, headers: this.#getHeaders() }
    )
    .then(response => {
      if (!response.ok)
        throw new Error(`Responsestatus is ${response.status}, which is not ok!`);

      const respType = response.headers.get("content-type");
      if (!(respType == "text/plain"))
        throw new Error(`Response type is '${respType}', expected 'text/plain'!`);

      return response.text();
    })
    .then(data => {
      // console.log(`response from REST-API is '${data}'.`);

      if (data === '_') { // seems to mean that initializing polling was successful
        // console.debug(`REST-API: Connect first time response. first=${this.#firstPoll}`)
        this.#setPollstate(true);
        this.#resubscribeAll();
        this.#firstPoll = false;
      } else
      if (data === '') {  // seems to mean that the polling time has elapsed without receiving a message
        // console.debug(`REST-API: No response within the long poll time of ${this.#pollPeriod}ms`)
        this.onEmptyPoll && this.onEmptyPoll(new Date().getTime());
      } else {      // all other responses should be in JSON as text
        try {
          console.debug(`REST-API: '${data}'`);
          data = JSON.parse(data);
        } catch (error) {
          throw new Error(`Can not parse to JSON: '${data}'`);
        }

        if (data?.disconnect === true) {    // seems to mean that the connection to the REST-API has been lost
          console.info(`REST-API: connection lost`);
          this.#setPollstate(false);
          throw new Error('connection lost');
        }

        if (this.#subscriptions[data.id])
          data.iddata = this.#subscriptions[data.id].iddata;
        else
          data.iddata = {};

        this.onPollMsg && this.onPollMsg(data);
      }

      this.#lngPoll(); // Start the long poll again
    })
    .catch(error => {
      this.#setPollstate(false);

      // Handle abort error
      if (error?.name === 'AbortError') {
        console.warn(`REST-API: long polling aborted!`)
      } else {
        // Handle other errors
        console.error('REST-API: ', error?.toString());
        this.onError && this.onError(error);
      }   // if (not abort error)

      if (!this.#abortCtrl.signal.aborted) {
        let reconnTime = this.#retryPollDelay;
        if (this.onError) {
          reconnTime = this.onError(error);
          if (!reconnTime || reconnTime < 0)
            reconnTime = this.#retryPollDelay;
        }
        console.info(`REST-API: Try to restart polling after ${reconnTime} milliseconds...`);

        setTimeout(() => { this.startPolling() }, reconnTime);  // wait and then try to long poll again
      }   // if (not aborted)
    }); // catch(error)
  }   // #lngPoll()
}   // class C_RestApi