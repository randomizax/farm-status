// ==UserScript==
// @id             iitc-plugin-farm-status@randomizax
// @name           IITC plugin: Report farm status
// @category       Info
// @version        0.1.3.@@DATETIMEVERSION@@
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      @@UPDATEURL@@
// @downloadURL    @@DOWNLOADURL@@
// @description    [@@BUILDNAME@@-@@BUILDDATE@@] Display exportable list of portals as TSV(CSV).
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==

@@PLUGINSTART@@

// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.farmStatus = {};
window.plugin.farmStatus.clicker = null;
window.plugin.farmStatus.farm = null;

window.plugin.farmStatus.Farm = L.Class.extend({
  statics: {
    CORE: 0,
    NEIBOR: 1,
  },
  options: {
    name: 'Farm',
    faction: window.TEAM_ENL,
    portals: {}, // guid => CORE/NEIBOR
    bbox: null, // L.LatLngBounds
    corePolygons: [],
    neiborPolygons: [],
  },
  initialize: function(options) {
    options = options || {};
    for (var type in this.options) {
      if (this.options.hasOwnProperty(type)) {
	if (options[type]) {
	  options[type] = L.extend({}, this.options[type], options[type]);
	}
      }
    }
    this.options.portals = {};
    this.options.corePolygons = [];
    this.options.neiborPolygons = [];
    console.log(this);
  },
  add: function(guid, tier) {
    var tier = tier || window.plugin.farmStatus.Farm.CORE;
    var portal = window.portals[guid];
    if (portal === null) return;
    this.options.portals[guid] = tier;
    console.log(guid + " -> " + tier);
  },
  remove: function(guid) {
    delete this.options.portals[guid];
  },
  count: function() {
    var enl_lvls = [null, 0,0,0,0,0,0,0,0];
    var reg_lvls = [null, 0,0,0,0,0,0,0,0];
    var neu_lvls = [null, 0,0,0,0,0,0,0,0];
    var farm = this;
    console.log("farm.options.faction = " + farm.options.faction);
    $.each(window.portals, function(guid, portal) {
      if (farm.options.portals[guid] == window.plugin.farmStatus.Farm.CORE) {
        console.log(portal);
        var lvl = portal.options.level;
        var team = portal.options.team;
        var counter = team == window.TEAM_ENL ? enl_lvls : team == window.TEAM_RES ? reg_lvls : neu_lvls;
        if (lvl < 6) lvl = 6;
        counter[lvl]++;
      }
    });
    var enl = "ENL: P8 x " + enl_lvls[8] + ";  P7 x " + enl_lvls[7] + ";  P6- x " + enl_lvls[6];
    var reg = "RES: P8 x " + reg_lvls[8] + ";  P7 x " + reg_lvls[7] + ";  P6- x " + reg_lvls[6];
    var neu = "Neutral: " + neu_lvls[6];

    return enl + "<br/>" + reg + "<br/>" + neu;
  },

});


// Detect if a point is inside polygon.
/*
pnpoly Copyright (c) 1970-2003, Wm. Randolph Franklin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

  1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
     disclaimers.
  2. Redistributions in binary form must reproduce the above copyright notice in the documentation and/or other
     materials provided with the distribution.
  3. The name of W. Randolph Franklin may not be used to endorse or promote products derived from this Software without
     specific prior written permission.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
window.plugin.farmStatus.pointInPolygon = function ( polygon, pt ) {
  var poly = polygon.getLatLngs();

  for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i) {
    if (((poly[i].lat <= pt.lat && pt.lat < poly[j].lat) ||
         (poly[j].lat <= pt.lat && pt.lat < poly[i].lat)) &&
        (pt.lng < (poly[j].lng - poly[i].lng) * (pt.lat - poly[i].lat) / (poly[j].lat - poly[i].lat) + poly[i].lng)) {
      c = !c;
    }
  }
  return c;
};

// Return guid of the clicked portal
//  null if none
window.plugin.farmStatus.portalOnPoint = function(unsnappedLatLng) {
  var containerPoint = map.latLngToContainerPoint(unsnappedLatLng);
  var candidates = [];
  $.each(window.portals, function(guid, portal) {
    var ll = portal.getLatLng();
    var pp = map.latLngToContainerPoint(ll);
    var size = portal.options.weight + portal.options.radius;
    var dist = pp.distanceTo(containerPoint);
    if(dist > size) return true;
    candidates.push([dist, guid]);
  });

  if(candidates.length === 0) return null;
  candidates = candidates.sort(function(a, b) { return a[0]-b[0]; });
  return candidates[0][1];
};

// Be sure to run after draw-tool is loaded.
window.plugin.farmStatus.defineClicker = function(L) {
  if (L.Clicker) return;

  L.Clicker = L.Draw.Feature.extend({
    statics: {
      TYPE: 'clicker'
    },

    options: {
      icon: new L.DivIcon({
        iconSize: new L.Point(8, 8),
        className: 'leaflet-div-icon leaflet-editing-icon'
      }),
      repeatMode: true,
      metric: true, // Whether to use the metric measurement system or imperial
      zIndexOffset: 2000 // This should be > than the highest z-index any map layers
    },

    initialize: function (map, options) {
      // Save the type so super can fire, need to do this as cannot do this.TYPE :(
      this.type = L.Clicker.TYPE;

      L.Draw.Feature.prototype.initialize.call(this, map, options);
    },

    addHooks: function () {
      L.Draw.Feature.prototype.addHooks.call(this);
      if (this._map) {
        this._markers = [];

        this._markerGroup = new L.LayerGroup();
        this._map.addLayer(this._markerGroup);

        this._tooltip.updateContent(this._getTooltipText());

        if (!this._mouseMarker) {
	  this._mouseMarker = L.marker(this._map.getCenter(), {
	    icon: L.divIcon({
	      className: 'leaflet-mouse-marker',
	      iconAnchor: [20, 20],
	      iconSize: [40, 40]
	    }),
	    opacity: 0,
	    zIndexOffset: this.options.zIndexOffset
	  });
        }

        this._mouseMarker
	  .on('click', this._onClick, this)
	  .addTo(this._map);

        this._map
	  .on('mousemove', this._onMouseMove, this);
      }
    },

    removeHooks: function () {
      L.Draw.Feature.prototype.removeHooks.call(this);

      this._mouseMarker.off('click', this._onClick, this);
      this._map.removeLayer(this._mouseMarker);
      delete this._mouseMarker;

      this._map
        .off('mousemove', this._onMouseMove, this);
    },

    _finishShape: function () {
      this.disable();
    },

    _onMouseMove: function (e) {
      var newPos = e.layerPoint,
      latlng = e.latlng;

      // Save latlng
      this._currentLatLng = latlng;

      this._updateTooltip(latlng);

      // Update the mouse marker position
      this._mouseMarker.setLatLng(latlng);

      L.DomEvent.preventDefault(e.originalEvent);
    },

    _onClick: function (e) {
      var latlng = e.target.getLatLng();

      // console.log(["Clicker._onClick", latlng]);
      window.plugin.farmStatus.pick(latlng);

      this._updateTooltip();
    },

    _getTooltipText: function() {
      return { text: 'Click on portal or polygon' };
    },

    _updateTooltip: function (latLng) {
      var text = this._getTooltipText();

      if (latLng) {
        this._tooltip.updatePosition(latLng);
      }

      if (!this._errorShown) {
        this._tooltip.updateContent(text);
      }
    },

  });
};

// return { area: area, cog: center_of_gravity_latlng }
window.plugin.farmStatus.polygonInfo = function(polygon) {
  var poly = polygon.getLatLngs();
  var n = poly.length;
  if (n == 0) return [ 0, null ] ;
  var glat = 0.0, glng = 0.0, area = 0.0;
  var p1 = poly[n-1];
  for (var i = 0; i < n; i++) {
    var p2 = poly[i];
    var s = (p2.lat * p1.lng - p1.lat * p2.lng) / 2.0;
    area += s;
    glat += s * (p1.lat + p2.lat) / 3.0;
    glng += s * (p1.lng + p2.lng) / 3.0;
    p1 = p2;
  }
  glat /= (area + 0.0);
  glng /= (area + 0.0);
  return { area: area, cog: new L.LatLng(glat, glng) };
};

// Pick a portal at the point.
//  Or a portals enclosed in the (innermost) polygon at the point.
window.plugin.farmStatus.pick = function(point) {
  var portalGuid = window.plugin.farmStatus.portalOnPoint(point);

  if (portalGuid) {
    var portal = window.portals[portalGuid];
    // console.log([portal.options.data.title, portal.getLatLng()]);
    window.plugin.farmStatus.farm.add(portalGuid, window.plugin.farmStatus.Farm.CORE);
  } else {
    var candidates = [];
    window.plugin.drawTools.drawnItems.eachLayer( function( layer ) {
      if ( window.plugin.farmStatus.pointInPolygon( layer, point ) ) {
        if (layer instanceof L.GeodesicCircle ||
            layer instanceof L.Circle ||
            layer instanceof L.GeodesicPolygon ||
            layer instanceof L.Polygon ||
            layer instanceof L.GeodesicPolyline ||
            layer instanceof L.Polyline) {
          candidates.push([Math.abs(window.plugin.farmStatus.polygonInfo(layer).area), layer]);
        }
      }
    });
    if (candidates.length == 0) {
      // console.log("nothing");
    } else {
      // find innermost (i.e. smallest) polygon
      candidates = candidates.sort(function(a, b) { return a[0]-b[0]; });
      polygon = candidates[0][1];
      $.each(window.portals, function(i, portal) {
        if (window.plugin.farmStatus.pointInPolygon( polygon, portal.getLatLng() )) {
          // console.log([portal.options.data.title, portal.getLatLng()]);
          window.plugin.farmStatus.farm.add(portal.options.guid, window.plugin.farmStatus.farm.CORE);
        }
      });
    }
  }
  window.plugin.farmStatus.updateStats();
};

window.plugin.farmStatus.updateStats = function() {
  window.plugin.farmStatus.tooltip.innerHTML = window.plugin.farmStatus.farm.count();
};

window.plugin.farmStatus.onBtnClick = function(ev) {
  var btn = window.plugin.farmStatus.button,
  tooltip = window.plugin.farmStatus.tooltip,
  layer = window.plugin.farmStatus.layer;

  if (btn.classList.contains("active")) {
    window.plugin.farmStatus.clicker.disable();
    btn.classList.remove("active");
  } else {
    window.plugin.farmStatus.farm = new window.plugin.farmStatus.Farm();
    window.plugin.farmStatus.clicker.enable();
    btn.classList.add("active");
    window.plugin.farmStatus.updateStats();
  }
};

window.plugin.farmStatus.onTipClick = function(ev) {
  dialog({
    html: $('<div id="farmStatus">' + window.plugin.farmStatus.farm.count() + "</div>"),
    dialogClass: 'ui-dialog-farm-status',
    title: 'Farm Status',
    id: 'farm-status-copy',
    width: 300
  });
};

var setup = function() {
  $('<style>').prop('type', 'text/css').html('@@INCLUDESTRING:src/farm-status.css@@').appendTo('head');

  window.plugin.farmStatus.defineClicker(L);
  window.plugin.farmStatus.clicker = new L.Clicker(map, {});

  var parent = $(".leaflet-top.leaflet-left", window.map.getContainer());

  var button = document.createElement("a");
  button.className = "leaflet-bar-part";
  button.addEventListener("click", window.plugin.farmStatus.onBtnClick, false);
  button.title = 'Count portal levels in polygons';

  var tooltip = document.createElement("div");
  tooltip.className = "leaflet-control-farm-status-tooltip";
  tooltip.addEventListener("click", window.plugin.farmStatus.onTipClick, false);
  button.appendChild(tooltip);

  var container = document.createElement("div");
  container.className = "leaflet-control-farm-status leaflet-bar leaflet-control";
  container.appendChild(button);
  parent.append(container);

  window.plugin.farmStatus.button = button;
  window.plugin.farmStatus.tooltip = tooltip;
  window.plugin.farmStatus.container = container;
};


// PLUGIN END //////////////////////////////////////////////////////////

@@PLUGINEND@@
