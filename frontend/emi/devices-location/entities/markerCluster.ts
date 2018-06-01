// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import {} from 'markerclustererplus';
import {} from 'googlemaps';
import {} from 'google-maps';

export class MarkerCluster extends MarkerClusterer {

  constructor(map: google.maps.Map, markers?: google.maps.Marker[], options?: MarkerClustererOptions) {
    super(map, markers, options);
  }


}
