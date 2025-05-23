// ==UserScript==
// @id             iitc-plugin-farm-status@randomizax
// @name           IITC plugin: Report farm status
// @category       Info
// @version        2.0.0.20250420.52731
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @updateURL      https://randomizax.github.io/farm-status/farm-status.meta.js
// @downloadURL    https://randomizax.github.io/farm-status/farm-status.user.js
// @description    [randomizax-2025-04-20-052731] Count portals in polygon/polyline per portal level.
// @include        https://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
// plugin_info.buildName = 'randomizax';
// plugin_info.dateTimeVersion = '20250420.52731';
// plugin_info.pluginId = 'farm-status';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.farmStatus = {};
window.plugin.farmStatus.clicker = null;
window.plugin.farmStatus.farm = null;


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

  var onpoly = false;
  for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i) {
    if (poly[i].lat == pt.lat && poly[i].lng == pt.lng)
      onpoly = true;
    if (((poly[i].lat <= pt.lat && pt.lat < poly[j].lat) ||
         (poly[j].lat <= pt.lat && pt.lat < poly[i].lat)) &&
        (pt.lng < (poly[j].lng - poly[i].lng) * (pt.lat - poly[i].lat) / (poly[j].lat - poly[i].lat) + poly[i].lng)) {
      c = !c;
    }
  }
  return c | onpoly;
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
    },
    add: function(guid, tier) {
      var tier = tier || window.plugin.farmStatus.Farm.CORE;
      var portal = window.portals[guid];
      if (portal === null) return;
      this.options.portals[guid] = tier;
    },
    remove: function(guid) {
      delete this.options.portals[guid];
    },
    count: function() {
      var enl_lvls = [null, 0,0,0,0,0,0,0,0];
      var res_lvls = [null, 0,0,0,0,0,0,0,0];
      var neu_lvls = [null, 0,0,0,0,0,0,0,0];
      var total = 0;
      var farm = this;
      // console.log("farm.options.faction = " + farm.options.faction);
      $.each(window.portals, function(guid, portal) {
        if (farm.options.portals[guid] == window.plugin.farmStatus.Farm.CORE) {
          // console.log(portal);
          var lvl = portal.options.level;
          var team = portal.options.team;
          var counter = team == window.TEAM_ENL ? enl_lvls : team == window.TEAM_RES ? res_lvls : neu_lvls;
          if (lvl < 6) lvl = 6;
          counter[lvl]++;
          total++;
        }
      });
      var enl = [];
      if (enl_lvls[8] > 0) enl.push("P8 x " + enl_lvls[8]);
      if (enl_lvls[7] > 0) enl.push("P7 x " + enl_lvls[7]);
      if (enl_lvls[6] > 0) enl.push("P6- x " + enl_lvls[6]);
      var res = [];
      if (res_lvls[8] > 0) res.push("P8 x " + res_lvls[8]);
      if (res_lvls[7] > 0) res.push("P7 x " + res_lvls[7]);
      if (res_lvls[6] > 0) res.push("P6- x " + res_lvls[6]);
      var str = [];
      if (enl.length > 0) str.push("ENL: " + enl.join(";  "));
      if (res.length > 0) str.push("RES: " + res.join(";  "));
      if (neu_lvls[6] > 0) str.push("Neutral: " + neu_lvls[6]);
      str.push("Total: " + total);

      return str.length == 0 ? "Add portal or polygon" : str.join("<br/>");
    },

  });

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
      if (layer instanceof L.GeodesicCircle ||
          layer instanceof L.Circle ||
          layer instanceof L.GeodesicPolygon ||
          layer instanceof L.Polygon ||
          layer instanceof L.GeodesicPolyline ||
          layer instanceof L.Polyline) {
        if ( window.plugin.farmStatus.pointInPolygon( layer, point ) ) {
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
  $('<style>').prop('type', 'text/css').html('.leaflet-control-farm-status a\n{\n	background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAABhElEQVRYw+2XzW3CUAzHf0HcywiMEEboxeeyQTtBR2gzQcsEZQM4+0I7QbMBYYNskF78pNeQl7ykPHEoliIZy/Hn33aAG/13ylIZFpFfv1W1U2+WyHkDNDG6s9SZD9F8wNgCeACWJqqAvarWyTEgIjmw85zjBbFW1bIn82bIvsPErCdz57wGCntqk+1Mp93zdu9D8nAFLJNH4MNEK8BlmwPfxj8B21bGvaSqWSwG/LKXAX7Zk8hZC0JjOI8IPHf9Nlw4uusyfKkp8FF+EJGN8c+e/HSJKQgFsAXejF8ALwGdoZ5PXkQO+SEqWlU6A3cX4KL3gPVxYYjv2gMroFZVROTVWrMHClWt/ryIPCDlwMGCcZW596bBH1e/NdGBZBE73W1EgPWA89GBZBMPy5DzNh6mHaOuF0VkjPPLnmOryBjnZYrvge0I3TpFAEWMYaOvFAFUwOYqFfBA+R5ZhSQYcJltInSqyYsocj8cbVV/mrOT8aVfob49MPl/Qczdj7mGN7o6/QBHl4lmP2K56wAAAABJRU5ErkJggg==);\n}\n.leaflet-control-farm-status a.active\n{\n	background-color: #BBB;\n}\n.leaflet-control-farm-status-tooltip\n{\n	background-color: rgba(255, 255, 255, 0.6);\n	display: none;\n	height: 72px;\n	left: 30px;\n	line-height: 15px;\n	margin-left: 15px;\n	margin-top: -12px;\n	padding: 4px 10px;\n	position: absolute;\n	top: 50%;\n	white-space: nowrap;\n	width: auto;\n}\n.leaflet-control-farm-status a.active .leaflet-control-farm-status-tooltip\n{\n	display: block;\n}\n.leaflet-control-farm-status a.finish .leaflet-control-farm-status-tooltip\n{\n	display: block;\n}\n.leaflet-control-farm-status-tooltip:before\n{\n	border-color: transparent rgba(255, 255, 255, 0.6);\n	border-style: solid;\n	border-width: 12px 12px 12px 0;\n	content: "";\n	display: block;\n	height: 0;\n	left: -12px;\n	position: absolute;\n	width: 0;\n}\n').appendTo('head');

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


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


