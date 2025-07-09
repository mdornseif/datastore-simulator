[![version](https://img.shields.io/npm/v/datastore-simulator.svg?style=flat-square)](https://npmjs.org/datastore-simulator)


# datastore-simulator

This is a in process Simulator for the Google Cloud Datastore Node.js Client [@google-cloud/datastore
](https://github.com/googleapis/nodejs-datastore) for easy integration testing.

It is inspired by [datastore-mock](https://github.com/KoryNunn/datastore-mock) but tries be 
Typescript compatible and model the Cloud Datastore API surface as close as possible.

datastore-simulator does *not* try to model transactions, queries and consistency. 

##

Usage:

Just intatiate a Datastore from 'datastore-simulator':

```
import {Datastore} from 'datastore-simulator'
```

## See also

* [datastore-mock](https://www.npmjs.com/package/datastore-mock)
* [@google-cloud/datastore](https://www.npmjs.com/package/@google-cloud/datastore)
* [google-datastore-emulator](https://www.npmjs.com/package/google-datastore-emulator)
* [datastore-api](https://www.npmjs.com/package/datastore-api)