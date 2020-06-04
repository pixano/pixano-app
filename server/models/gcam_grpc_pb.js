// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var gcam_pb = require('./gcam_pb.js');

function serialize_gcam_GcamReply(arg) {
  if (!(arg instanceof gcam_pb.GcamReply)) {
    throw new Error('Expected argument of type gcam.GcamReply');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gcam_GcamReply(buffer_arg) {
  return gcam_pb.GcamReply.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gcam_GcamRequest(arg) {
  if (!(arg instanceof gcam_pb.GcamRequest)) {
    throw new Error('Expected argument of type gcam.GcamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gcam_GcamRequest(buffer_arg) {
  return gcam_pb.GcamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


// The gcam service definition.
var GcamService = exports.GcamService = {
  // Sends a gcam trasnform request
projectPoints: {
    path: '/gcam.Gcam/ProjectPoints',
    requestStream: false,
    responseStream: false,
    requestType: gcam_pb.GcamRequest,
    responseType: gcam_pb.GcamReply,
    requestSerialize: serialize_gcam_GcamRequest,
    requestDeserialize: deserialize_gcam_GcamRequest,
    responseSerialize: serialize_gcam_GcamReply,
    responseDeserialize: deserialize_gcam_GcamReply,
  },
};

exports.GcamClient = grpc.makeGenericClientConstructor(GcamService);
