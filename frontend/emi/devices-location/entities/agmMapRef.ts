import {} from 'googlemaps';

export class MapRef extends google.maps.Map {

  constructor(mapDiv: Element|null, opts?: google.maps.MapOptions){
    super(mapDiv, opts);
  }

}
