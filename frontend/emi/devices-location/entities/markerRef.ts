// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import {} from 'googlemaps';

export class MarkerRef extends google.maps.Marker {

  animation_changedEvent = new  Rx.Subject();
  clickEvent = new Rx.Subject <google.maps.MouseEvent>();
  clickable_changedEvent = new  Rx.Subject();
  cursor_changedEvent = new  Rx.Subject();
  dblclickEvent = new  Rx.Subject();
  dragEvent = new  Rx.Subject();
  dragendEvent = new  Rx.Subject();
  draggable_changedEvent = new  Rx.Subject();
  dragstartEvent = new  Rx.Subject();
  flat_changedEvent = new  Rx.Subject();
  icon_changedEvent = new  Rx.Subject();
  mousedownEvent = new  Rx.Subject();
  mouseoutEvent = new  Rx.Subject();
  mouseoverEvent = new  Rx.Subject();
  mouseupEvent = new  Rx.Subject();
  position_changedEvent = new  Rx.Subject();
  rightclickEvent = new  Rx.Subject();
  shape_changedEvent = new  Rx.Subject();
  title_changedEvent = new  Rx.Subject();
  visible_changedEvent = new  Rx.Subject();
  zindex_changedEvent = new  Rx.Subject();


  contentString = '<div id="content">' +
      '<div id="siteNotice">' +
      '</div>' +
      '<h1 id="firstHeading" class="firstHeading">Uluru</h1>' +
      '<div id="bodyContent">' +
      '<p><b>Uluru</b>, also referred to as <b>Ayers Rock</b>, is a large ' +
      'Heritage Site.</p>' +
      '<p>Attribution: Uluru, <a href="https://en.wikipedia.org/w/index.php?title=Uluru&oldid=297882194">' +
      'https://en.wikipedia.org/w/index.php?title=Uluru</a> ' +
      '(last visited June 22, 2009).</p>' +
      '</div>' +
      '</div>';

  infoWindow =  new google.maps.InfoWindow({
    content: ''
  });


  constructor(opts?: google.maps.MarkerOptions) {
    super(opts);
    this.setClickable(true);
    this.setLabel('Default label');
    this.setTitle('default Title');
    this.setDraggable(true);
  }

  updateLocation(lng: number, lat: number, delay: number): void {
    // X refer to logitude
    // Y refer to latitude
    this.setVisibility(100);
    const currentLng = this.getPosition().lng();
    const currentLat = this.getPosition().lat();
    const updateDelay = 5;
    const vx = (lng - currentLng) / delay;
    const vy = (lat - currentLat) / delay;
    const timer = Rx.Observable.interval(updateDelay);
    const maximunSteps = delay / updateDelay;
    let steps = 0;
    const subcription = timer.subscribe(() => {
      this.setPosition(
        new google.maps.LatLng(
          this.getPosition().lat() + vy * updateDelay,
          this.getPosition().lng() + vx * updateDelay
        )
      );
      steps++;
      const distance = this.distanceBetweenTwoPoints(
        this.getPosition().lng(), lng,
        this.getPosition().lat(), lat
      );
      if (steps >= maximunSteps || distance < 0.00001) {
        subcription.unsubscribe();
      }
    });
  }

  distanceBetweenTwoPoints(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  setVisibility(visibility: number): void {
    this.setOpacity(visibility / 100);
  }

  inizialiteEvents(){
    this.addListener('click', (e: google.maps.MouseEvent) => { this.clickEvent.next(e); });
    this.addListener('dblclick', (e) => { this.dblclickEvent.next(e); });
    this.addListener('dragend', (e) => { this.dragendEvent.next(e); });
    // this.addListener('position_changed', (e) => { this.position_changedEvent.next(e); });
  }

}
