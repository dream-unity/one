// Shared public boundary contracts. Generated from reviewed du-prototype/1.0 schemas.
// Schema validity cannot prove origin, cryptographic freshness, consent, authority,
// quota, epoch ownership, or application outcomes. Those are owned runtime checks.
function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeDeep(item);
    Object.freeze(value);
  }
  return value;
}
export const contractVersion = 'du-prototype/1.0';
export const schemas = freezeDeep({
  "actionRequest": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Controller-owned action envelope v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "version": {
        "const": 1
      },
      "sessionId": {
        "type": "string",
        "format": "uuid"
      },
      "turnId": {
        "type": "string",
        "format": "uuid"
      },
      "requestId": {
        "type": "string",
        "format": "uuid"
      },
      "routeEpoch": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "consentEpoch": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "memoryRevision": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "tool": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "navigate"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "destination": {
                    "type": "string",
                    "enum": [
                      "unity",
                      "manifesto",
                      "dream-world",
                      "earth",
                      "minds-eye",
                      "constellation"
                    ]
                  }
                },
                "required": [
                  "destination"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "return_to_previous"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {},
                "required": []
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "focus_world"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "world": {
                    "type": "string",
                    "enum": [
                      "machine",
                      "maker",
                      "world"
                    ]
                  }
                },
                "required": [
                  "world"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "set_scene_reflection"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "worlds": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "enum": [
                        "machine",
                        "maker",
                        "world"
                      ]
                    },
                    "minItems": 1,
                    "maxItems": 3,
                    "uniqueItems": true
                  },
                  "summary": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 240
                  },
                  "provisional": {
                    "const": true
                  }
                },
                "required": [
                  "worlds",
                  "summary",
                  "provisional"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "lookup_knowledge"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "query": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 512
                  },
                  "topics": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "enum": [
                        "definitions",
                        "philosophical-principles",
                        "ordinary-practice",
                        "manifestation-method",
                        "traditions",
                        "frontier"
                      ]
                    },
                    "minItems": 0,
                    "maxItems": 3,
                    "uniqueItems": true
                  }
                },
                "required": [
                  "query",
                  "topics"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "propose_memory"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "proposal": {
                    "anyOf": [
                      {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "operation": {
                            "const": "create_node"
                          },
                          "kind": {
                            "type": "string",
                            "enum": [
                              "goal",
                              "insight",
                              "project",
                              "possibility",
                              "question"
                            ]
                          },
                          "title": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 120
                          },
                          "text": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 1200
                          }
                        },
                        "required": [
                          "operation",
                          "kind",
                          "title",
                          "text"
                        ]
                      },
                      {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "operation": {
                            "const": "update_node"
                          },
                          "nodeId": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "expectedRevision": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 9007199254740991
                          },
                          "kind": {
                            "type": "string",
                            "enum": [
                              "goal",
                              "insight",
                              "project",
                              "possibility",
                              "question"
                            ]
                          },
                          "title": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 120
                          },
                          "text": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 1200
                          },
                          "status": {
                            "type": "string",
                            "enum": [
                              "active",
                              "paused",
                              "resolved",
                              "archived"
                            ]
                          }
                        },
                        "required": [
                          "operation",
                          "nodeId",
                          "expectedRevision",
                          "kind",
                          "title",
                          "text",
                          "status"
                        ]
                      },
                      {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "operation": {
                            "const": "create_edge"
                          },
                          "from": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "fromRevision": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 9007199254740991
                          },
                          "to": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "toRevision": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 9007199254740991
                          },
                          "relation": {
                            "type": "string",
                            "enum": [
                              "relates_to",
                              "supports",
                              "challenges",
                              "depends_on"
                            ]
                          },
                          "label": {
                            "type": "string",
                            "minLength": 0,
                            "maxLength": 240
                          }
                        },
                        "required": [
                          "operation",
                          "from",
                          "fromRevision",
                          "to",
                          "toRevision",
                          "relation",
                          "label"
                        ]
                      },
                      {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "operation": {
                            "const": "update_edge"
                          },
                          "edgeId": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "expectedRevision": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 9007199254740991
                          },
                          "relation": {
                            "type": "string",
                            "enum": [
                              "relates_to",
                              "supports",
                              "challenges",
                              "depends_on"
                            ]
                          },
                          "label": {
                            "type": "string",
                            "minLength": 0,
                            "maxLength": 240
                          }
                        },
                        "required": [
                          "operation",
                          "edgeId",
                          "expectedRevision",
                          "relation",
                          "label"
                        ]
                      }
                    ]
                  }
                },
                "required": [
                  "proposal"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_fly_to_location"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "query": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 160
                  },
                  "viewMode": {
                    "type": "string",
                    "enum": [
                      "close",
                      "overview"
                    ]
                  }
                },
                "required": [
                  "query",
                  "viewMode"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_fly_to_coordinates"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "latitude": {
                    "type": "number",
                    "minimum": -90,
                    "maximum": 90
                  },
                  "longitude": {
                    "type": "number",
                    "minimum": -180,
                    "maximum": 180
                  },
                  "rangeM": {
                    "type": "number",
                    "minimum": 100,
                    "maximum": 20000000
                  }
                },
                "required": [
                  "latitude",
                  "longitude",
                  "rangeM"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_zoom_to_globe"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {},
                "required": []
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_set_layer_visibility"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "layerId": {
                    "type": "string",
                    "enum": [
                      "flights",
                      "military",
                      "satellites",
                      "radio",
                      "cctv",
                      "traffic"
                    ]
                  },
                  "visible": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "layerId",
                  "visible"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_set_visual_style"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "style": {
                    "type": "string",
                    "enum": [
                      "normal",
                      "retro",
                      "surveillance",
                      "thermal",
                      "anime",
                      "noir",
                      "snow"
                    ]
                  }
                },
                "required": [
                  "style"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_open_feed"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "radio",
                      "cctv",
                      "traffic"
                    ]
                  }
                },
                "required": [
                  "kind"
                ]
              }
            },
            "required": [
              "name",
              "args"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "const": "earth_get_view"
              },
              "args": {
                "type": "object",
                "additionalProperties": false,
                "properties": {},
                "required": []
              }
            },
            "required": [
              "name",
              "args"
            ]
          }
        ]
      }
    },
    "required": [
      "version",
      "sessionId",
      "turnId",
      "requestId",
      "routeEpoch",
      "consentEpoch",
      "memoryRevision",
      "tool"
    ]
  },
  "actionResult": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Observed action result v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "version": {
        "const": 1
      },
      "requestId": {
        "type": "string",
        "format": "uuid"
      },
      "routeEpoch": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "status": {
        "type": "string",
        "enum": [
          "applied",
          "noop",
          "blocked",
          "rejected",
          "cancelled",
          "superseded",
          "failed",
          "unknown"
        ]
      },
      "code": {
        "type": "string",
        "minLength": 1,
        "maxLength": 80
      },
      "message": {
        "type": "string",
        "minLength": 0,
        "maxLength": 400
      },
      "observedState": {
        "anyOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "destination": {
                "type": "string",
                "enum": [
                  "unity",
                  "manifesto",
                  "dream-world",
                  "earth",
                  "minds-eye",
                  "constellation"
                ]
              },
              "worldFocus": {
                "anyOf": [
                  {
                    "type": "string",
                    "enum": [
                      "machine",
                      "maker",
                      "world"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "earth": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "globe": {
                        "type": "string",
                        "enum": [
                          "not-started",
                          "loading",
                          "ready",
                          "failed"
                        ]
                      },
                      "restore": {
                        "type": "string",
                        "enum": [
                          "none",
                          "pending",
                          "applied",
                          "superseded",
                          "failed"
                        ]
                      },
                      "mediaMode": {
                        "type": "string",
                        "enum": [
                          "conversation",
                          "media"
                        ]
                      }
                    },
                    "required": [
                      "globe",
                      "restore",
                      "mediaMode"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "destination",
              "worldFocus",
              "earth"
            ]
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "version",
      "requestId",
      "routeEpoch",
      "status",
      "code",
      "message",
      "observedState"
    ]
  },
  "earthBridge": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Trusted Earth bridge v1",
    "oneOf": [
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "INIT"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "HELLO"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "buildCommit": {
                "type": "string",
                "pattern": "^[a-f0-9]{40}$"
              },
              "capabilities": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "tools": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "enum": [
                        "earth_fly_to_location",
                        "earth_fly_to_coordinates",
                        "earth_zoom_to_globe",
                        "earth_set_layer_visibility",
                        "earth_set_visual_style",
                        "earth_open_feed",
                        "earth_get_view"
                      ]
                    },
                    "minItems": 0,
                    "maxItems": 12,
                    "uniqueItems": true
                  },
                  "suspension": {
                    "type": "boolean"
                  },
                  "mediaPreflight": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "tools",
                  "suspension",
                  "mediaPreflight"
                ]
              }
            },
            "required": [
              "buildCommit",
              "capabilities"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "START"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "restore": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "format": {
                        "const": "gev-share-v2"
                      },
                      "hashParams": {
                        "type": "string",
                        "minLength": 0,
                        "maxLength": 8192
                      },
                      "feed": {
                        "anyOf": [
                          {
                            "type": "string",
                            "enum": [
                              "radio",
                              "cctv",
                              "traffic"
                            ]
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "hasUnsavedState": {
                        "type": "boolean"
                      }
                    },
                    "required": [
                      "format",
                      "hashParams",
                      "feed",
                      "hasUnsavedState"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "restore"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "READY"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "app": {
                "type": "string",
                "enum": [
                  "waiting",
                  "starting",
                  "ready",
                  "failed"
                ]
              },
              "globe": {
                "type": "string",
                "enum": [
                  "not-started",
                  "loading",
                  "ready",
                  "failed"
                ]
              },
              "restore": {
                "type": "string",
                "enum": [
                  "none",
                  "pending",
                  "applied",
                  "superseded",
                  "failed"
                ]
              },
              "providers": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "id": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 80
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "ready",
                        "not-configured",
                        "protected",
                        "unavailable",
                        "requires-persistent-service",
                        "unknown"
                      ]
                    }
                  },
                  "required": [
                    "id",
                    "status"
                  ]
                },
                "minItems": 0,
                "maxItems": 32
              }
            },
            "required": [
              "app",
              "globe",
              "restore",
              "providers"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "FAILED"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "code": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80
              },
              "message": {
                "type": "string",
                "minLength": 0,
                "maxLength": 400
              },
              "retryable": {
                "type": "boolean"
              }
            },
            "required": [
              "code",
              "message",
              "retryable"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "COMMAND"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "turnId": {
                "type": "string",
                "format": "uuid"
              },
              "tool": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_fly_to_location"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "query": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 160
                          },
                          "viewMode": {
                            "type": "string",
                            "enum": [
                              "close",
                              "overview"
                            ]
                          }
                        },
                        "required": [
                          "query",
                          "viewMode"
                        ]
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_fly_to_coordinates"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "latitude": {
                            "type": "number",
                            "minimum": -90,
                            "maximum": 90
                          },
                          "longitude": {
                            "type": "number",
                            "minimum": -180,
                            "maximum": 180
                          },
                          "rangeM": {
                            "type": "number",
                            "minimum": 100,
                            "maximum": 20000000
                          }
                        },
                        "required": [
                          "latitude",
                          "longitude",
                          "rangeM"
                        ]
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_zoom_to_globe"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {},
                        "required": []
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_set_layer_visibility"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "layerId": {
                            "type": "string",
                            "enum": [
                              "flights",
                              "military",
                              "satellites",
                              "radio",
                              "cctv",
                              "traffic"
                            ]
                          },
                          "visible": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "layerId",
                          "visible"
                        ]
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_set_visual_style"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "style": {
                            "type": "string",
                            "enum": [
                              "normal",
                              "retro",
                              "surveillance",
                              "thermal",
                              "anime",
                              "noir",
                              "snow"
                            ]
                          }
                        },
                        "required": [
                          "style"
                        ]
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_open_feed"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "kind": {
                            "type": "string",
                            "enum": [
                              "radio",
                              "cctv",
                              "traffic"
                            ]
                          }
                        },
                        "required": [
                          "kind"
                        ]
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "name": {
                        "const": "earth_get_view"
                      },
                      "args": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {},
                        "required": []
                      }
                    },
                    "required": [
                      "name",
                      "args"
                    ]
                  }
                ]
              }
            },
            "required": [
              "turnId",
              "tool"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "CANCEL"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "commandRequestId": {
                "anyOf": [
                  {
                    "type": "string",
                    "format": "uuid"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "commandRequestId"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "RESULT"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "status": {
                "type": "string",
                "enum": [
                  "applied",
                  "noop",
                  "blocked",
                  "rejected",
                  "cancelled",
                  "superseded",
                  "failed",
                  "unknown"
                ]
              },
              "code": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80
              },
              "message": {
                "type": "string",
                "minLength": 0,
                "maxLength": 400
              },
              "snapshot": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "format": {
                        "const": "gev-share-v2"
                      },
                      "hashParams": {
                        "type": "string",
                        "minLength": 0,
                        "maxLength": 8192
                      },
                      "feed": {
                        "anyOf": [
                          {
                            "type": "string",
                            "enum": [
                              "radio",
                              "cctv",
                              "traffic"
                            ]
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "hasUnsavedState": {
                        "type": "boolean"
                      }
                    },
                    "required": [
                      "format",
                      "hashParams",
                      "feed",
                      "hasUnsavedState"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "status",
              "code",
              "message",
              "snapshot"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "SUSPEND"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "reason": {
                "type": "string",
                "enum": [
                  "route-exit",
                  "tab-hidden",
                  "media-transition",
                  "exit"
                ]
              }
            },
            "required": [
              "reason"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "RESUME"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "hostVisible": {
                "const": true
              }
            },
            "required": [
              "hostVisible"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "ACK"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "forKind": {
                "type": "string",
                "enum": [
                  "SUSPEND",
                  "RESUME",
                  "MEDIA_FOCUS_GRANTED",
                  "REQUEST_HOME",
                  "CANCEL"
                ]
              },
              "active": {
                "type": "boolean"
              }
            },
            "required": [
              "forKind",
              "active"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "REQUEST_HOME"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "SNAPSHOT_REQUEST"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "SNAPSHOT"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "snapshot": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "format": {
                        "const": "gev-share-v2"
                      },
                      "hashParams": {
                        "type": "string",
                        "minLength": 0,
                        "maxLength": 8192
                      },
                      "feed": {
                        "anyOf": [
                          {
                            "type": "string",
                            "enum": [
                              "radio",
                              "cctv",
                              "traffic"
                            ]
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "hasUnsavedState": {
                        "type": "boolean"
                      }
                    },
                    "required": [
                      "format",
                      "hashParams",
                      "feed",
                      "hasUnsavedState"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "snapshot"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "MEDIA_FOCUS_REQUEST"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "reason": {
                "type": "string",
                "enum": [
                  "player-surface",
                  "native-fullscreen"
                ]
              }
            },
            "required": [
              "reason"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "MEDIA_FOCUS_GRANTED"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "captureStopped": {
                "const": true
              },
              "outputStopped": {
                "const": true
              }
            },
            "required": [
              "captureStopped",
              "outputStopped"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "QUIET_REQUEST"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "QUIET_ACK"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "quiet": {
                "type": "boolean"
              },
              "blockedPlayerCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 32
              }
            },
            "required": [
              "quiet",
              "blockedPlayerCount"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "channel": {
            "const": "dream-unity:earth"
          },
          "version": {
            "const": 1
          },
          "bridgeId": {
            "type": "string",
            "format": "uuid"
          },
          "epoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "const": "STATUS"
          },
          "payload": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "app": {
                "type": "string",
                "enum": [
                  "waiting",
                  "starting",
                  "ready",
                  "failed"
                ]
              },
              "globe": {
                "type": "string",
                "enum": [
                  "not-started",
                  "loading",
                  "ready",
                  "failed"
                ]
              },
              "restore": {
                "type": "string",
                "enum": [
                  "none",
                  "pending",
                  "applied",
                  "superseded",
                  "failed"
                ]
              },
              "providers": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "id": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 80
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "ready",
                        "not-configured",
                        "protected",
                        "unavailable",
                        "requires-persistent-service",
                        "unknown"
                      ]
                    }
                  },
                  "required": [
                    "id",
                    "status"
                  ]
                },
                "minItems": 0,
                "maxItems": 32
              }
            },
            "required": [
              "app",
              "globe",
              "restore",
              "providers"
            ]
          }
        },
        "required": [
          "channel",
          "version",
          "bridgeId",
          "epoch",
          "requestId",
          "kind",
          "payload"
        ]
      }
    ]
  },
  "constellation": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Device-only confirmed constellation v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "schemaVersion": {
        "const": 1
      },
      "revision": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "consentEpoch": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "consent": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "policyVersion": {
            "const": "constellation-1"
          },
          "storageEnabled": {
            "type": "boolean"
          },
          "conversationUseEnabled": {
            "type": "boolean"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "policyVersion",
          "storageEnabled",
          "conversationUseEnabled",
          "updatedAt"
        ]
      },
      "nodes": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "kind": {
              "type": "string",
              "enum": [
                "goal",
                "insight",
                "project",
                "possibility",
                "question"
              ]
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 1200
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "paused",
                "resolved",
                "archived"
              ]
            },
            "authorship": {
              "type": "string",
              "enum": [
                "user",
                "ai-confirmed"
              ]
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "revision": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            }
          },
          "required": [
            "id",
            "kind",
            "title",
            "text",
            "status",
            "authorship",
            "createdAt",
            "updatedAt",
            "revision"
          ]
        },
        "minItems": 0,
        "maxItems": 128
      },
      "edges": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "from": {
              "type": "string",
              "format": "uuid"
            },
            "to": {
              "type": "string",
              "format": "uuid"
            },
            "relation": {
              "type": "string",
              "enum": [
                "relates_to",
                "supports",
                "challenges",
                "depends_on"
              ]
            },
            "label": {
              "type": "string",
              "minLength": 0,
              "maxLength": 240
            },
            "authorship": {
              "type": "string",
              "enum": [
                "user",
                "ai-confirmed"
              ]
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "revision": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            }
          },
          "required": [
            "id",
            "from",
            "to",
            "relation",
            "label",
            "authorship",
            "createdAt",
            "updatedAt",
            "revision"
          ]
        },
        "minItems": 0,
        "maxItems": 256
      }
    },
    "required": [
      "schemaVersion",
      "revision",
      "consentEpoch",
      "consent",
      "nodes",
      "edges"
    ]
  },
  "realtimeStart": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Private Realtime startup v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "version": {
        "const": 1
      },
      "requestId": {
        "type": "string",
        "format": "uuid"
      },
      "attemptId": {
        "type": "string",
        "format": "uuid"
      },
      "sdp": {
        "type": "string",
        "minLength": 1,
        "maxLength": 60000
      },
      "locale": {
        "type": "string",
        "enum": [
          "en-AU",
          "en-US",
          "en-GB"
        ]
      },
      "canonVersion": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "consentEpoch": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "consentedMemories": {
        "type": "array",
        "items": {
          "anyOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "recordType": {
                  "const": "node"
                },
                "id": {
                  "type": "string",
                  "format": "uuid"
                },
                "revision": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "kind": {
                  "type": "string",
                  "enum": [
                    "goal",
                    "insight",
                    "project",
                    "possibility",
                    "question"
                  ]
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1200
                },
                "status": {
                  "type": "string",
                  "enum": [
                    "active",
                    "paused",
                    "resolved",
                    "archived"
                  ]
                }
              },
              "required": [
                "recordType",
                "id",
                "revision",
                "kind",
                "title",
                "text",
                "status"
              ]
            },
            {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "recordType": {
                  "const": "edge"
                },
                "id": {
                  "type": "string",
                  "format": "uuid"
                },
                "revision": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "from": {
                  "type": "string",
                  "format": "uuid"
                },
                "to": {
                  "type": "string",
                  "format": "uuid"
                },
                "relation": {
                  "type": "string",
                  "enum": [
                    "relates_to",
                    "supports",
                    "challenges",
                    "depends_on"
                  ]
                },
                "label": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 240
                }
              },
              "required": [
                "recordType",
                "id",
                "revision",
                "from",
                "to",
                "relation",
                "label"
              ]
            }
          ]
        },
        "minItems": 0,
        "maxItems": 6
      }
    },
    "required": [
      "version",
      "requestId",
      "attemptId",
      "sdp",
      "locale",
      "canonVersion",
      "consentEpoch",
      "consentedMemories"
    ]
  },
  "access": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Private preview invite exchange v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "version": {
        "const": 1
      },
      "inviteCode": {
        "type": "string",
        "minLength": 22,
        "maxLength": 128,
        "pattern": "^[A-Za-z0-9_-]+$"
      }
    },
    "required": [
      "version",
      "inviteCode"
    ]
  },
  "knowledgeRequest": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Authenticated corpus lookup v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "version": {
        "const": 1
      },
      "canonVersion": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "query": {
        "type": "string",
        "minLength": 1,
        "maxLength": 512
      },
      "topics": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "definitions",
            "philosophical-principles",
            "ordinary-practice",
            "manifestation-method",
            "traditions",
            "frontier"
          ]
        },
        "minItems": 0,
        "maxItems": 3,
        "uniqueItems": true
      }
    },
    "required": [
      "version",
      "canonVersion",
      "query",
      "topics"
    ]
  },
  "sessionClose": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Owned session cleanup v1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "version": {
        "const": 1
      },
      "sessionId": {
        "type": "string",
        "format": "uuid"
      },
      "closeToken": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2048
      },
      "reason": {
        "type": "string",
        "enum": [
          "stop",
          "exit",
          "hidden",
          "expired",
          "revoked",
          "transport-failed",
          "operator"
        ]
      }
    },
    "required": [
      "version",
      "sessionId",
      "closeToken",
      "reason"
    ]
  },
  "textTurn": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Bounded text start/result/cancel v1",
    "oneOf": [
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "version": {
            "const": 1
          },
          "kind": {
            "const": "start"
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "turnId": {
            "type": "string",
            "format": "uuid"
          },
          "conversationId": {
            "type": "string",
            "format": "uuid"
          },
          "turnEpoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "routeEpoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "consentEpoch": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "memoryRevision": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 8192
          },
          "history": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "role": {
                  "type": "string",
                  "enum": [
                    "user",
                    "assistant"
                  ]
                },
                "content": {
                  "type": "string",
                  "minLength": 0,
                  "maxLength": 8192
                }
              },
              "required": [
                "role",
                "content"
              ]
            },
            "minItems": 0,
            "maxItems": 12
          },
          "uiContext": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "destination": {
                "type": "string",
                "enum": [
                  "unity",
                  "manifesto",
                  "dream-world",
                  "earth",
                  "minds-eye",
                  "constellation"
                ]
              },
              "worldFocus": {
                "anyOf": [
                  {
                    "type": "string",
                    "enum": [
                      "machine",
                      "maker",
                      "world"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "earth": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "globe": {
                        "type": "string",
                        "enum": [
                          "not-started",
                          "loading",
                          "ready",
                          "failed"
                        ]
                      },
                      "restore": {
                        "type": "string",
                        "enum": [
                          "none",
                          "pending",
                          "applied",
                          "superseded",
                          "failed"
                        ]
                      },
                      "mediaMode": {
                        "type": "string",
                        "enum": [
                          "conversation",
                          "media"
                        ]
                      }
                    },
                    "required": [
                      "globe",
                      "restore",
                      "mediaMode"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "destination",
              "worldFocus",
              "earth"
            ]
          },
          "consentedMemories": {
            "type": "array",
            "items": {
              "anyOf": [
                {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "recordType": {
                      "const": "node"
                    },
                    "id": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "revision": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    },
                    "kind": {
                      "type": "string",
                      "enum": [
                        "goal",
                        "insight",
                        "project",
                        "possibility",
                        "question"
                      ]
                    },
                    "title": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 120
                    },
                    "text": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 1200
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "active",
                        "paused",
                        "resolved",
                        "archived"
                      ]
                    }
                  },
                  "required": [
                    "recordType",
                    "id",
                    "revision",
                    "kind",
                    "title",
                    "text",
                    "status"
                  ]
                },
                {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "recordType": {
                      "const": "edge"
                    },
                    "id": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "revision": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    },
                    "from": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "to": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "relation": {
                      "type": "string",
                      "enum": [
                        "relates_to",
                        "supports",
                        "challenges",
                        "depends_on"
                      ]
                    },
                    "label": {
                      "type": "string",
                      "minLength": 0,
                      "maxLength": 240
                    }
                  },
                  "required": [
                    "recordType",
                    "id",
                    "revision",
                    "from",
                    "to",
                    "relation",
                    "label"
                  ]
                }
              ]
            },
            "minItems": 0,
            "maxItems": 6
          }
        },
        "required": [
          "version",
          "kind",
          "requestId",
          "turnId",
          "conversationId",
          "turnEpoch",
          "routeEpoch",
          "consentEpoch",
          "memoryRevision",
          "message",
          "history",
          "uiContext",
          "consentedMemories"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "version": {
            "const": 1
          },
          "kind": {
            "const": "result"
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "turnId": {
            "type": "string",
            "format": "uuid"
          },
          "actionId": {
            "type": "string",
            "format": "uuid"
          },
          "continuationToken": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "result": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "version": {
                "const": 1
              },
              "requestId": {
                "type": "string",
                "format": "uuid"
              },
              "routeEpoch": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "status": {
                "type": "string",
                "enum": [
                  "applied",
                  "noop",
                  "blocked",
                  "rejected",
                  "cancelled",
                  "superseded",
                  "failed",
                  "unknown"
                ]
              },
              "code": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80
              },
              "message": {
                "type": "string",
                "minLength": 0,
                "maxLength": 400
              },
              "observedState": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "destination": {
                        "type": "string",
                        "enum": [
                          "unity",
                          "manifesto",
                          "dream-world",
                          "earth",
                          "minds-eye",
                          "constellation"
                        ]
                      },
                      "worldFocus": {
                        "anyOf": [
                          {
                            "type": "string",
                            "enum": [
                              "machine",
                              "maker",
                              "world"
                            ]
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "earth": {
                        "anyOf": [
                          {
                            "type": "object",
                            "additionalProperties": false,
                            "properties": {
                              "globe": {
                                "type": "string",
                                "enum": [
                                  "not-started",
                                  "loading",
                                  "ready",
                                  "failed"
                                ]
                              },
                              "restore": {
                                "type": "string",
                                "enum": [
                                  "none",
                                  "pending",
                                  "applied",
                                  "superseded",
                                  "failed"
                                ]
                              },
                              "mediaMode": {
                                "type": "string",
                                "enum": [
                                  "conversation",
                                  "media"
                                ]
                              }
                            },
                            "required": [
                              "globe",
                              "restore",
                              "mediaMode"
                            ]
                          },
                          {
                            "type": "null"
                          }
                        ]
                      }
                    },
                    "required": [
                      "destination",
                      "worldFocus",
                      "earth"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "version",
              "requestId",
              "routeEpoch",
              "status",
              "code",
              "message",
              "observedState"
            ]
          }
        },
        "required": [
          "version",
          "kind",
          "requestId",
          "turnId",
          "actionId",
          "continuationToken",
          "result"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "version": {
            "const": 1
          },
          "kind": {
            "const": "cancel"
          },
          "requestId": {
            "type": "string",
            "format": "uuid"
          },
          "turnId": {
            "type": "string",
            "format": "uuid"
          }
        },
        "required": [
          "version",
          "kind",
          "requestId",
          "turnId"
        ]
      }
    ]
  },
  "toolCall": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Allowed model proposals v1",
    "oneOf": [
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "navigate"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "destination": {
                "type": "string",
                "enum": [
                  "unity",
                  "manifesto",
                  "dream-world",
                  "earth",
                  "minds-eye",
                  "constellation"
                ]
              }
            },
            "required": [
              "destination"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "return_to_previous"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "focus_world"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "world": {
                "type": "string",
                "enum": [
                  "machine",
                  "maker",
                  "world"
                ]
              }
            },
            "required": [
              "world"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "set_scene_reflection"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "worlds": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "machine",
                    "maker",
                    "world"
                  ]
                },
                "minItems": 1,
                "maxItems": 3,
                "uniqueItems": true
              },
              "summary": {
                "type": "string",
                "minLength": 1,
                "maxLength": 240
              },
              "provisional": {
                "const": true
              }
            },
            "required": [
              "worlds",
              "summary",
              "provisional"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "lookup_knowledge"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "query": {
                "type": "string",
                "minLength": 1,
                "maxLength": 512
              },
              "topics": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "definitions",
                    "philosophical-principles",
                    "ordinary-practice",
                    "manifestation-method",
                    "traditions",
                    "frontier"
                  ]
                },
                "minItems": 0,
                "maxItems": 3,
                "uniqueItems": true
              }
            },
            "required": [
              "query",
              "topics"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "propose_memory"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "proposal": {
                "anyOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "operation": {
                        "const": "create_node"
                      },
                      "kind": {
                        "type": "string",
                        "enum": [
                          "goal",
                          "insight",
                          "project",
                          "possibility",
                          "question"
                        ]
                      },
                      "title": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 120
                      },
                      "text": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 1200
                      }
                    },
                    "required": [
                      "operation",
                      "kind",
                      "title",
                      "text"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "operation": {
                        "const": "update_node"
                      },
                      "nodeId": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "expectedRevision": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 9007199254740991
                      },
                      "kind": {
                        "type": "string",
                        "enum": [
                          "goal",
                          "insight",
                          "project",
                          "possibility",
                          "question"
                        ]
                      },
                      "title": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 120
                      },
                      "text": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 1200
                      },
                      "status": {
                        "type": "string",
                        "enum": [
                          "active",
                          "paused",
                          "resolved",
                          "archived"
                        ]
                      }
                    },
                    "required": [
                      "operation",
                      "nodeId",
                      "expectedRevision",
                      "kind",
                      "title",
                      "text",
                      "status"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "operation": {
                        "const": "create_edge"
                      },
                      "from": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "fromRevision": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 9007199254740991
                      },
                      "to": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "toRevision": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 9007199254740991
                      },
                      "relation": {
                        "type": "string",
                        "enum": [
                          "relates_to",
                          "supports",
                          "challenges",
                          "depends_on"
                        ]
                      },
                      "label": {
                        "type": "string",
                        "minLength": 0,
                        "maxLength": 240
                      }
                    },
                    "required": [
                      "operation",
                      "from",
                      "fromRevision",
                      "to",
                      "toRevision",
                      "relation",
                      "label"
                    ]
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "operation": {
                        "const": "update_edge"
                      },
                      "edgeId": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "expectedRevision": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 9007199254740991
                      },
                      "relation": {
                        "type": "string",
                        "enum": [
                          "relates_to",
                          "supports",
                          "challenges",
                          "depends_on"
                        ]
                      },
                      "label": {
                        "type": "string",
                        "minLength": 0,
                        "maxLength": 240
                      }
                    },
                    "required": [
                      "operation",
                      "edgeId",
                      "expectedRevision",
                      "relation",
                      "label"
                    ]
                  }
                ]
              }
            },
            "required": [
              "proposal"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_fly_to_location"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "query": {
                "type": "string",
                "minLength": 1,
                "maxLength": 160
              },
              "viewMode": {
                "type": "string",
                "enum": [
                  "close",
                  "overview"
                ]
              }
            },
            "required": [
              "query",
              "viewMode"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_fly_to_coordinates"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "latitude": {
                "type": "number",
                "minimum": -90,
                "maximum": 90
              },
              "longitude": {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              },
              "rangeM": {
                "type": "number",
                "minimum": 100,
                "maximum": 20000000
              }
            },
            "required": [
              "latitude",
              "longitude",
              "rangeM"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_zoom_to_globe"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_set_layer_visibility"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "layerId": {
                "type": "string",
                "enum": [
                  "flights",
                  "military",
                  "satellites",
                  "radio",
                  "cctv",
                  "traffic"
                ]
              },
              "visible": {
                "type": "boolean"
              }
            },
            "required": [
              "layerId",
              "visible"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_set_visual_style"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "style": {
                "type": "string",
                "enum": [
                  "normal",
                  "retro",
                  "surveillance",
                  "thermal",
                  "anime",
                  "noir",
                  "snow"
                ]
              }
            },
            "required": [
              "style"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_open_feed"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "kind": {
                "type": "string",
                "enum": [
                  "radio",
                  "cctv",
                  "traffic"
                ]
              }
            },
            "required": [
              "kind"
            ]
          }
        },
        "required": [
          "name",
          "args"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "const": "earth_get_view"
          },
          "args": {
            "type": "object",
            "additionalProperties": false,
            "properties": {},
            "required": []
          }
        },
        "required": [
          "name",
          "args"
        ]
      }
    ]
  }
});
export const toolDefinitions = freezeDeep({
  "version": "du-prototype/1.0",
  "validation_required": true,
  "tools": [
    {
      "name": "navigate",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "destination": {
            "type": "string",
            "enum": [
              "unity",
              "manifesto",
              "dream-world",
              "earth",
              "minds-eye",
              "constellation"
            ]
          }
        },
        "required": [
          "destination"
        ]
      }
    },
    {
      "name": "return_to_previous",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {},
        "required": []
      }
    },
    {
      "name": "focus_world",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "world": {
            "type": "string",
            "enum": [
              "machine",
              "maker",
              "world"
            ]
          }
        },
        "required": [
          "world"
        ]
      }
    },
    {
      "name": "set_scene_reflection",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "worlds": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "machine",
                "maker",
                "world"
              ]
            },
            "minItems": 1,
            "maxItems": 3,
            "uniqueItems": true
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 240
          },
          "provisional": {
            "const": true
          }
        },
        "required": [
          "worlds",
          "summary",
          "provisional"
        ]
      }
    },
    {
      "name": "lookup_knowledge",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          },
          "topics": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "definitions",
                "philosophical-principles",
                "ordinary-practice",
                "manifestation-method",
                "traditions",
                "frontier"
              ]
            },
            "minItems": 0,
            "maxItems": 3,
            "uniqueItems": true
          }
        },
        "required": [
          "query",
          "topics"
        ]
      }
    },
    {
      "name": "propose_memory",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "proposal": {
            "anyOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "operation": {
                    "const": "create_node"
                  },
                  "kind": {
                    "type": "string",
                    "enum": [
                      "goal",
                      "insight",
                      "project",
                      "possibility",
                      "question"
                    ]
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 120
                  },
                  "text": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 1200
                  }
                },
                "required": [
                  "operation",
                  "kind",
                  "title",
                  "text"
                ]
              },
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "operation": {
                    "const": "update_node"
                  },
                  "nodeId": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "expectedRevision": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  },
                  "kind": {
                    "type": "string",
                    "enum": [
                      "goal",
                      "insight",
                      "project",
                      "possibility",
                      "question"
                    ]
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 120
                  },
                  "text": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 1200
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "active",
                      "paused",
                      "resolved",
                      "archived"
                    ]
                  }
                },
                "required": [
                  "operation",
                  "nodeId",
                  "expectedRevision",
                  "kind",
                  "title",
                  "text",
                  "status"
                ]
              },
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "operation": {
                    "const": "create_edge"
                  },
                  "from": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "fromRevision": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  },
                  "to": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "toRevision": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  },
                  "relation": {
                    "type": "string",
                    "enum": [
                      "relates_to",
                      "supports",
                      "challenges",
                      "depends_on"
                    ]
                  },
                  "label": {
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 240
                  }
                },
                "required": [
                  "operation",
                  "from",
                  "fromRevision",
                  "to",
                  "toRevision",
                  "relation",
                  "label"
                ]
              },
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "operation": {
                    "const": "update_edge"
                  },
                  "edgeId": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "expectedRevision": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  },
                  "relation": {
                    "type": "string",
                    "enum": [
                      "relates_to",
                      "supports",
                      "challenges",
                      "depends_on"
                    ]
                  },
                  "label": {
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 240
                  }
                },
                "required": [
                  "operation",
                  "edgeId",
                  "expectedRevision",
                  "relation",
                  "label"
                ]
              }
            ]
          }
        },
        "required": [
          "proposal"
        ]
      }
    },
    {
      "name": "earth_fly_to_location",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "viewMode": {
            "type": "string",
            "enum": [
              "close",
              "overview"
            ]
          }
        },
        "required": [
          "query",
          "viewMode"
        ]
      }
    },
    {
      "name": "earth_fly_to_coordinates",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "latitude": {
            "type": "number",
            "minimum": -90,
            "maximum": 90
          },
          "longitude": {
            "type": "number",
            "minimum": -180,
            "maximum": 180
          },
          "rangeM": {
            "type": "number",
            "minimum": 100,
            "maximum": 20000000
          }
        },
        "required": [
          "latitude",
          "longitude",
          "rangeM"
        ]
      }
    },
    {
      "name": "earth_zoom_to_globe",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {},
        "required": []
      }
    },
    {
      "name": "earth_set_layer_visibility",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "layerId": {
            "type": "string",
            "enum": [
              "flights",
              "military",
              "satellites",
              "radio",
              "cctv",
              "traffic"
            ]
          },
          "visible": {
            "type": "boolean"
          }
        },
        "required": [
          "layerId",
          "visible"
        ]
      }
    },
    {
      "name": "earth_set_visual_style",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "style": {
            "type": "string",
            "enum": [
              "normal",
              "retro",
              "surveillance",
              "thermal",
              "anime",
              "noir",
              "snow"
            ]
          }
        },
        "required": [
          "style"
        ]
      }
    },
    {
      "name": "earth_open_feed",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "kind": {
            "type": "string",
            "enum": [
              "radio",
              "cctv",
              "traffic"
            ]
          }
        },
        "required": [
          "kind"
        ]
      }
    },
    {
      "name": "earth_get_view",
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {},
        "required": []
      }
    }
  ]
});
