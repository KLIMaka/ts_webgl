
function drag(e) {
  e.stopPropagation();
  e.preventDefault();
}

export class DropFileReader {

  constructor(
    private elem:HTMLElement, 
    private validator:(f:File)=>boolean, 
    private callback:(b:ArrayBuffer)=>void) 
  {
    var self = this;
    elem.addEventListener("dragenter", drag, false);
    elem.addEventListener("dragover", drag, false);
    elem.addEventListener("drop", (e)=>{self.drop(e)}, false);
  }

  private drop(e):void {
    e.stopPropagation();
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    var valid = this.validator(file);
    if (!valid)
      return;
    e.target.classList.add('valid');

    var self = this;
    var reader = new FileReader();
    reader.onload = (e) => {self.callback(e.target.result)}
    reader.readAsArrayBuffer(file);
  }

}