//Controller for column show/hide
ndpDataEntry.controller('LeftBarMenuController',
        function($scope, $location) {
    $scope.showDataEntry = function(){
        selection.load();
        $location.path('/dataentry').search();
    };
    
    $scope.showReports = function(){
        selection.load();
        $location.path('/reports').search();
    };
});