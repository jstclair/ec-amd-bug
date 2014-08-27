/// <amd-dependency path="text!./home.html" />
/// <amd-dependency path="editableCell" />
import ko = require("knockout");
export var template: string = require("text!./home.html");

export class viewModel {
    public message = ko.observable("Welcome to ec-amd-bug!");

    public doSomething() {
        this.message('Awesome!');
    }
}
